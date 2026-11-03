const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  makeAdmin,
  createVenue,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const venueNotifications = async (user) =>
  (
    await pool.query(
      "SELECT message, venue_id, reservation_id FROM notifications WHERE user_id = $1 ORDER BY id",
      [user.id]
    )
  ).rows;

// Teren sa vlasnikom koji prima rezervacije od 8 do 22h
const bookableVenue = async (owner, overrides = {}) => {
  const venue = await createVenue({ pricePerHour: 3000, ...overrides });
  await pool.query(
    `UPDATE venues
     SET owner_id = $2, accepts_reservations = true,
         reservation_open_hour = 8, reservation_close_hour = 22
     WHERE id = $1`,
    [venue.id, owner.id]
  );

  return { ...venue, owner_id: owner.id };
};

const book = (venue, user, body = {}) =>
  api
    .post(`/api/venues/${venue.id}/reservations`)
    .set(auth(user))
    .send({ date: dateIn(3), start_hour: 18, hours: 2, ...body });

const action = (reservation, user, name, body = {}) =>
  api.post(`/api/reservations/${reservation.id}/${name}`).set(auth(user)).send(body);

describe("vlasništvo terena", () => {
  test("korisnik traži vlasništvo, admin dobija notifikaciju i odobrava", async () => {
    const [admin, user] = [await createUser(), await createUser("Vlasnik")];
    await makeAdmin(admin);
    const venue = await createVenue();

    const claim = await api
      .post(`/api/venues/${venue.id}/claim`)
      .set(auth(user))
      .send({ message: "Zovite me na 064..." });

    expect(claim.status).toBe(201);
    expect((await venueNotifications(admin))[0].message).toMatch(/Zahtev za vlasništvo/);

    const claims = await api.get("/api/venues/admin/claims").set(auth(admin));
    expect(claims.body.claims).toHaveLength(1);
    expect(claims.body.claims[0]).toMatchObject({ user_name: "Vlasnik", message: "Zovite me na 064..." });
    expect(claims.body.claims[0].user_email).toMatch(/@test\.rs$/);

    const res = await api
      .post(`/api/venues/claims/${claims.body.claims[0].id}/approve`)
      .set(auth(admin));

    expect(res.status).toBe(200);
    const owner = await pool.query("SELECT owner_id FROM venues WHERE id = $1", [venue.id]);
    expect(owner.rows[0].owner_id).toBe(user.id);
    expect((await venueNotifications(user))[0].message).toMatch(/Sada si vlasnik/);

    const page = await api.get(`/api/venues/${venue.id}`).set(auth(user));
    expect(page.body).toMatchObject({ is_owner: true, can_edit: true, is_admin: false, my_claim: "approved" });
  });

  test("odobravanje jednog zahteva odbija ostale za isti teren", async () => {
    const [admin, first, second] = [await createUser(), await createUser(), await createUser()];
    await makeAdmin(admin);
    const venue = await createVenue();
    await api.post(`/api/venues/${venue.id}/claim`).set(auth(first));
    await api.post(`/api/venues/${venue.id}/claim`).set(auth(second));
    const claims = (await api.get("/api/venues/admin/claims").set(auth(admin))).body.claims;

    await api.post(`/api/venues/claims/${claims[0].id}/approve`).set(auth(admin));

    const statuses = await pool.query("SELECT user_id, status FROM venue_claims ORDER BY id");
    expect(statuses.rows).toEqual([
      { user_id: first.id, status: "approved" },
      { user_id: second.id, status: "rejected" },
    ]);
    expect((await venueNotifications(second))[0].message).toMatch(/nije odobren/);
  });

  test("ne može dvaput isti zahtev, ni za teren koji već ima vlasnika", async () => {
    const [owner, user] = [await createUser(), await createUser()];
    const free = await createVenue();
    const owned = await bookableVenue(owner, { name: "Zauzet" });

    await api.post(`/api/venues/${free.id}/claim`).set(auth(user));
    const again = await api.post(`/api/venues/${free.id}/claim`).set(auth(user));
    const taken = await api.post(`/api/venues/${owned.id}/claim`).set(auth(user));

    expect(again.status).toBe(400);
    expect(taken.body.message).toMatch(/već ima vlasnika/);
  });

  test("samo admin vidi i odobrava zahteve", async () => {
    const user = await createUser();
    const venue = await createVenue();
    await api.post(`/api/venues/${venue.id}/claim`).set(auth(user));
    const { rows } = await pool.query("SELECT id FROM venue_claims");

    const list = await api.get("/api/venues/admin/claims").set(auth(user));
    const approve = await api.post(`/api/venues/claims/${rows[0].id}/approve`).set(auth(user));

    expect([list.status, approve.status]).toEqual([403, 403]);
  });

  test("vlasnik menja podatke svog terena, ali ne i tuđeg i ne briše", async () => {
    const [owner, other] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const body = {
      name: "Novo ime",
      address: "Nova adresa",
      latitude: 42.9,
      longitude: 20.9,
      sports: ["Fudbal"],
    };

    const own = await api.put(`/api/venues/${venue.id}`).set(auth(owner)).send(body);
    const foreign = await api.put(`/api/venues/${venue.id}`).set(auth(other)).send(body);
    const remove = await api.delete(`/api/venues/${venue.id}`).set(auth(owner));

    expect(own.status).toBe(200);
    expect(own.body.venue.name).toBe("Novo ime");
    expect(foreign.status).toBe(403);
    expect(remove.status).toBe(403);
  });

  test("admin uklanja vlasnika: rezervacije se isključuju, zahtevi odbijaju", async () => {
    const [admin, owner, player] = [await createUser(), await createUser(), await createUser()];
    await makeAdmin(admin);
    const venue = await bookableVenue(owner);
    await book(venue, player);

    const res = await api.delete(`/api/venues/${venue.id}/owner`).set(auth(admin));

    expect(res.status).toBe(200);
    const after = await pool.query("SELECT owner_id, accepts_reservations FROM venues WHERE id = $1", [venue.id]);
    expect(after.rows[0]).toEqual({ owner_id: null, accepts_reservations: false });
    const reservation = await pool.query("SELECT status FROM venue_reservations");
    expect(reservation.rows[0].status).toBe("rejected");
    expect((await venueNotifications(owner)).pop().message).toMatch(/Više nisi vlasnik/);
  });

  test("moji tereni vraća terene vlasnika sa brojem zahteva", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    await createVenue({ name: "Tuđi" });
    await book(venue, player);

    const res = await api.get("/api/venues/mine").set(auth(owner));
    const status = await api.get("/api/venues/admin/status").set(auth(owner));

    expect(res.body.venues).toHaveLength(1);
    expect(res.body.venues[0]).toMatchObject({ id: venue.id, pending_reservations: 1 });
    expect(status.body.owned_venues).toBe(1);
  });
});

describe("podešavanja rezervacija", () => {
  test("vlasnik uključuje rezervacije i menja sate", async () => {
    const owner = await createUser();
    const venue = await bookableVenue(owner);

    const res = await api
      .put(`/api/venues/${venue.id}/reservation-settings`)
      .set(auth(owner))
      .send({ accepts_reservations: true, reservation_open_hour: 10, reservation_close_hour: 24 });

    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      accepts_reservations: true,
      reservation_open_hour: 10,
      reservation_close_hour: 24,
    });
  });

  test.each([
    [{ reservation_open_hour: 20, reservation_close_hour: 18 }],
    [{ reservation_open_hour: -1 }],
    [{ reservation_close_hour: 25 }],
  ])("neispravni sati %p su odbijeni", async (hours) => {
    const owner = await createUser();
    const venue = await bookableVenue(owner);

    const res = await api
      .put(`/api/venues/${venue.id}/reservation-settings`)
      .set(auth(owner))
      .send({ accepts_reservations: true, ...hours });

    expect(res.status).toBe(400);
  });

  test("teren bez vlasnika ne može da prima rezervacije", async () => {
    const admin = await createUser();
    await makeAdmin(admin);
    const venue = await createVenue();

    const res = await api
      .put(`/api/venues/${venue.id}/reservation-settings`)
      .set(auth(admin))
      .send({ accepts_reservations: true });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/vlasnika/);
  });

  test("običan korisnik ne menja podešavanja", async () => {
    const [owner, other] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);

    const res = await api
      .put(`/api/venues/${venue.id}/reservation-settings`)
      .set(auth(other))
      .send({ accepts_reservations: false });

    expect(res.status).toBe(403);
  });
});

describe("rezervisanje", () => {
  test("zahtev čeka potvrdu, a vlasnik dobija notifikaciju", async () => {
    const [owner, player] = [await createUser(), await createUser("Pera")];
    const venue = await bookableVenue(owner);

    const res = await book(venue, player, { note: "Igramo 5 na 5" });

    expect(res.status).toBe(201);
    expect(res.body.reservation).toMatchObject({ status: "pending", start_hour: 18, end_hour: 20, note: "Igramo 5 na 5" });

    const [note] = await venueNotifications(owner);
    expect(note.message).toMatch(/Nov zahtev za rezervaciju: Sportski centar, .* od 18 do 20h \(Pera\)/);
    expect(note.reservation_id).toBe(res.body.reservation.id);
  });

  test("zauzeto vreme ne može ponovo da se rezerviše, susedno može", async () => {
    const [owner, a, b] = [await createUser(), await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    await book(venue, a, { start_hour: 18, hours: 2 });

    const overlap = await book(venue, b, { start_hour: 19, hours: 1 });
    const before = await book(venue, b, { start_hour: 16, hours: 2 });
    const after = await book(venue, b, { start_hour: 20, hours: 2 });

    expect(overlap.status).toBe(409);
    expect(before.status).toBe(201);
    expect(after.status).toBe(201);
  });

  test("odbijena rezervacija oslobađa vreme", async () => {
    const [owner, a, b] = [await createUser(), await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const first = (await book(venue, a)).body.reservation;

    await action(first, owner, "reject", { reason: "Turnir" });

    expect((await book(venue, b)).status).toBe(201);
  });

  test("dva istovremena zahteva za isto vreme: prolazi samo jedan", async () => {
    const [owner, a, b] = [await createUser(), await createUser(), await createUser()];
    const venue = await bookableVenue(owner);

    const results = await Promise.all([book(venue, a), book(venue, b)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  test.each([
    [{ start_hour: 7, hours: 1 }, /od 8 do 22h/],
    [{ start_hour: 21, hours: 2 }, /od 8 do 22h/],
    [{ hours: 5 }, /od 1 do 4/],
    [{ hours: 0 }, /od 1 do 4/],
    [{ date: "2026-02-30" }, /datum/],
    [{ date: dateIn(-1) }, /prošlosti/],
    [{ date: dateIn(90) }, /60 dana/],
    [{ note: "a".repeat(301) }, /Napomena/],
  ])("neispravna rezervacija %p je odbijena", async (body, message) => {
    const [owner, player] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);

    const res = await book(venue, player, body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  test("teren koji ne prima rezervacije odbija zahtev", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    await pool.query("UPDATE venues SET accepts_reservations = false WHERE id = $1", [venue.id]);

    const res = await book(venue, player);
    const free = await api.get(`/api/venues/${venue.id}/availability?date=${dateIn(3)}`);

    expect(res.status).toBe(404);
    expect(free.status).toBe(404);
  });

  test("vlasnik sam upisuje zauzet termin koji je odmah potvrđen", async () => {
    const owner = await createUser();
    const venue = await bookableVenue(owner);

    const res = await book(venue, owner, { note: "Telefonom: Marko" });

    expect(res.body.reservation.status).toBe("confirmed");
    expect(await venueNotifications(owner)).toHaveLength(0);
  });

  test("zauzetost dana je javna i bez imena", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    await book(venue, player, { start_hour: 18, hours: 2 });
    await book(venue, owner, { start_hour: 10, hours: 1 });

    const res = await api.get(`/api/venues/${venue.id}/availability?date=${dateIn(3)}`);

    expect(res.body).toMatchObject({ open_hour: 8, close_hour: 22, price_per_hour: 3000 });
    expect(res.body.busy).toEqual([
      { start_hour: 10, end_hour: 11, status: "confirmed" },
      { start_hour: 18, end_hour: 20, status: "pending" },
    ]);
  });
});

describe("potvrda i otkazivanje", () => {
  test("vlasnik potvrđuje, korisnik dobija obaveštenje", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const reservation = (await book(venue, player)).body.reservation;

    const res = await action(reservation, owner, "confirm");

    expect(res.body.reservation.status).toBe("confirmed");
    const [note] = await venueNotifications(player);
    expect(note.message).toMatch(/Rezervacija je potvrđena/);
    expect(note.reservation_id).toBe(reservation.id);
  });

  test("odbijanje šalje poruku vlasnika", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const reservation = (await book(venue, player)).body.reservation;

    await action(reservation, owner, "reject", { reason: "Teren je na održavanju." });

    const [note] = await venueNotifications(player);
    expect(note.message).toMatch(/nije prihvaćena.*Poruka vlasnika: Teren je na održavanju\./);
  });

  test("samo vlasnik potvrđuje, i samo zahteve na čekanju", async () => {
    const [owner, player, other] = [await createUser(), await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const reservation = (await book(venue, player)).body.reservation;

    expect((await action(reservation, player, "confirm")).status).toBe(403);
    expect((await action(reservation, other, "reject")).status).toBe(403);

    await action(reservation, owner, "confirm");
    expect((await action(reservation, owner, "reject")).status).toBe(400);
  });

  test("korisnik otkazuje svoju rezervaciju, vlasnik dobija obaveštenje", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const reservation = (await book(venue, player)).body.reservation;
    await action(reservation, owner, "confirm");

    const res = await action(reservation, player, "cancel");

    expect(res.body.reservation.status).toBe("cancelled");
    expect((await venueNotifications(owner)).pop().message).toMatch(/Rezervacija je otkazana/);
    expect((await action(reservation, player, "cancel")).status).toBe(400);
  });

  test("vlasnik otkazuje potvrđenu rezervaciju uz poruku", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const reservation = (await book(venue, player)).body.reservation;
    await action(reservation, owner, "confirm");

    await action(reservation, owner, "cancel", { reason: "Pukla cev." });

    expect((await venueNotifications(player)).pop().message).toMatch(
      /Vlasnik je otkazao rezervaciju.*Poruka: Pukla cev\./
    );
  });

  test("tuđa rezervacija ne može da se otkaže, ni ona koja je počela", async () => {
    const [owner, player, other] = [await createUser(), await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const reservation = (await book(venue, player)).body.reservation;
    const started = await pool.query(
      `INSERT INTO venue_reservations(venue_id, user_id, reservation_date, start_hour, end_hour, status)
       VALUES ($1, $2, $3, 10, 12, 'confirmed') RETURNING id`,
      [venue.id, player.id, dateIn(-1)]
    );

    expect((await action(reservation, other, "cancel")).status).toBe(403);

    const res = await action(started.rows[0], player, "cancel");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/već počela/);
  });
});

describe("liste rezervacija", () => {
  test("moje rezervacije i rezervacije na mojim terenima", async () => {
    const [owner, player, other] = [await createUser(), await createUser("Pera"), await createUser()];
    const venue = await bookableVenue(owner);
    const otherVenue = await bookableVenue(other, { name: "Tuđi teren" });
    await book(venue, player, { date: dateIn(5) });
    await book(venue, player, { date: dateIn(2) });
    await book(otherVenue, player);

    const mine = await api.get("/api/reservations/mine").set(auth(player));
    const forOwner = await api.get("/api/reservations/owner").set(auth(owner));

    expect(mine.body.reservations).toHaveLength(3);
    expect(mine.body.reservations[0].reservation_date).toBeDefined();
    expect(forOwner.body.reservations).toHaveLength(2);
    expect(forOwner.body.reservations[0]).toMatchObject({ venue_name: "Sportski centar", user_name: "Pera" });
    expect(forOwner.body.reservations[0].user_email).toMatch(/@test\.rs$/);
    expect(new Date(forOwner.body.reservations[0].reservation_date) <
      new Date(forOwner.body.reservations[1].reservation_date)).toBe(true);
  });
});
