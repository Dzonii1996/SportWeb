const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  addPlayers,
  createVenue,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const messagesOf = async (user) =>
  (
    await pool.query(
      "SELECT message, match_id, reservation_id FROM notifications WHERE user_id = $1 ORDER BY id",
      [user.id]
    )
  ).rows;

// Teren sa vlasnikom koji prima rezervacije od 8 do 23h
const bookableVenue = async (owner) => {
  const venue = await createVenue({ name: "SC Sunce", pricePerHour: 3000 });
  await pool.query(
    `UPDATE venues SET owner_id = $2, accepts_reservations = true,
            reservation_open_hour = 8, reservation_close_hour = 23
     WHERE id = $1`,
    [venue.id, owner.id]
  );

  return venue;
};

const matchBody = (venue, overrides = {}) => ({
  sport: "Fudbal",
  venue_id: venue.id,
  match_date: dateIn(3),
  match_time: "19:00",
  max_players: 10,
  ...overrides,
});

const createWithReservation = (venue, user, overrides = {}) =>
  api
    .post("/api/matches")
    .set(auth(user))
    .send(matchBody(venue, { reserve: true, reservation_hours: 2, ...overrides }));

const reservations = async () =>
  (await pool.query("SELECT * FROM venue_reservations ORDER BY id")).rows;

describe("rezervacija pri pravljenju termina", () => {
  test("termin i zahtev za rezervaciju se prave zajedno, vlasnik dobija notifikaciju", async () => {
    const [owner, organizer] = [await createUser(), await createUser("Organizator")];
    const venue = await bookableVenue(owner);

    const res = await createWithReservation(venue, organizer);

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Zahtev za rezervaciju terena je poslat/);
    expect(res.body.match).toMatchObject({
      reservation_status: "pending",
      reservation_start_hour: 19,
      reservation_end_hour: 21,
    });

    const [reservation] = await reservations();
    expect(reservation).toMatchObject({ user_id: organizer.id, start_hour: 19, end_hour: 21, status: "pending" });
    expect(res.body.match.reservation_id).toBe(reservation.id);
    expect((await messagesOf(owner))[0].message).toMatch(/Nov zahtev za rezervaciju.*Organizator/);

    const got = await api.get(`/api/matches/${res.body.match.id}`);
    expect(got.body.match).toMatchObject({ reservation_status: "pending", reservation_start_hour: 19 });
  });

  test("zauzet teren: ni termin se ne pravi", async () => {
    const [owner, first, second] = [await createUser(), await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    await createWithReservation(venue, first);

    const res = await createWithReservation(venue, second, { match_time: "20:00" });

    expect(res.status).toBe(409);
    const count = await pool.query("SELECT COUNT(*)::int AS n FROM matches");
    expect(count.rows[0].n).toBe(1);
  });

  test("rezervacija traži pun sat i teren koji prima rezervacije", async () => {
    const [owner, organizer] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const other = await createVenue({ name: "Bez rezervacija" });

    const halfHour = await createWithReservation(venue, organizer, { match_time: "19:30" });
    const notBookable = await createWithReservation(other, organizer);
    const manual = await api
      .post("/api/matches")
      .set(auth(organizer))
      .send({ ...matchBody(venue), venue_id: null, location: "Školsko", reserve: true });

    expect(halfHour.status).toBe(400);
    expect(halfHour.body.message).toMatch(/pun sat/);
    expect(notBookable.status).toBe(400);
    expect(notBookable.body.message).toMatch(/ne prima rezervacije/);
    expect(manual.status).toBe(400);
    expect(await reservations()).toHaveLength(0);
  });

  test("bez reserve se termin pravi bez rezervacije", async () => {
    const [owner, organizer] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);

    const res = await api.post("/api/matches").set(auth(organizer)).send(matchBody(venue));

    expect(res.status).toBe(201);
    expect(res.body.match.reservation_id).toBeNull();
    expect(await reservations()).toHaveLength(0);
  });

  test("vlasnik koji pravi termin na svom terenu dobija potvrđenu rezervaciju", async () => {
    const owner = await createUser();
    const venue = await bookableVenue(owner);

    const res = await createWithReservation(venue, owner);

    expect(res.body.match.reservation_status).toBe("confirmed");
    expect(res.body.message).toBe("Termin uspešno kreiran.");
  });
});

describe("termin iz postojeće rezervacije", () => {
  const reserve = async (venue, user, body = {}) =>
    (
      await api
        .post(`/api/venues/${venue.id}/reservations`)
        .set(auth(user))
        .send({ date: dateIn(4), start_hour: 18, hours: 2, ...body })
    ).body.reservation;

  test("teren, datum i vreme se uzimaju sa rezervacije", async () => {
    const [owner, user] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const reservation = await reserve(venue, user);

    const res = await api
      .post("/api/matches")
      .set(auth(user))
      .send(matchBody(venue, { reservation_id: reservation.id, venue_id: null, match_date: dateIn(9), match_time: "10:00" }));

    expect(res.status).toBe(201);
    expect(res.body.match).toMatchObject({
      reservation_id: reservation.id,
      venue_id: venue.id,
      location: "SC Sunce",
      match_time: "18:00:00",
    });

    const mine = await api.get("/api/reservations/mine").set(auth(user));
    expect(mine.body.reservations[0].match_id).toBe(res.body.match.id);
  });

  test("tuđa, otkazana ili već iskorišćena rezervacija ne može", async () => {
    const [owner, user, other] = [await createUser(), await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const reservation = await reserve(venue, user);
    const cancelled = await reserve(venue, user, { start_hour: 10 });
    await pool.query("UPDATE venue_reservations SET status = 'cancelled' WHERE id = $1", [cancelled.id]);

    const foreign = await api.post("/api/matches").set(auth(other)).send(matchBody(venue, { reservation_id: reservation.id }));
    const dead = await api.post("/api/matches").set(auth(user)).send(matchBody(venue, { reservation_id: cancelled.id }));
    await api.post("/api/matches").set(auth(user)).send(matchBody(venue, { reservation_id: reservation.id }));
    const twice = await api.post("/api/matches").set(auth(user)).send(matchBody(venue, { reservation_id: reservation.id }));

    expect(foreign.status).toBe(400);
    expect(dead.status).toBe(400);
    expect(twice.status).toBe(400);
    expect(twice.body.message).toMatch(/već napravljen termin/);
  });
});

describe("otkazivanje i izmena termina sa rezervacijom", () => {
  test("brisanje termina otkazuje rezervaciju i javlja vlasniku", async () => {
    const [owner, organizer] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const match = (await createWithReservation(venue, organizer)).body.match;

    const res = await api.delete(`/api/matches/${match.id}`).set(auth(organizer));

    expect(res.body.message).toMatch(/rezervacija terena otkazana/);
    expect((await reservations())[0].status).toBe("cancelled");
    expect((await messagesOf(owner)).pop().message).toMatch(/Rezervacija je otkazana \(termin je otkazan\)/);
  });

  test("keep_reservation zadržava rezervaciju", async () => {
    const [owner, organizer] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const match = (await createWithReservation(venue, organizer)).body.match;

    await api.delete(`/api/matches/${match.id}?keep_reservation=true`).set(auth(organizer));

    expect((await reservations())[0].status).toBe("pending");
  });

  test("dok je rezervacija aktivna, ne menjaju se datum, vreme ni teren", async () => {
    const [owner, organizer] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const match = (await createWithReservation(venue, organizer)).body.match;
    const edit = (overrides) =>
      api.put(`/api/matches/${match.id}`).set(auth(organizer)).send(matchBody(venue, overrides));

    const newTime = await edit({ match_time: "20:00" });
    const manual = await edit({ venue_id: null, location: "Drugo mesto" });
    const morePlayers = await edit({ max_players: 12 });

    expect(newTime.status).toBe(400);
    expect(newTime.body.message).toMatch(/vezan za rezervaciju terena \(19–21h\)/);
    expect(manual.status).toBe(400);
    expect(morePlayers.status).toBe(200);
  });

  test("posle otkazane rezervacije vreme može da se menja", async () => {
    const [owner, organizer] = [await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const match = (await createWithReservation(venue, organizer)).body.match;
    await api.post(`/api/reservations/${match.reservation_id}/cancel`).set(auth(organizer));

    const res = await api
      .put(`/api/matches/${match.id}`)
      .set(auth(organizer))
      .send(matchBody(venue, { match_time: "20:00" }));

    expect(res.status).toBe(200);
  });

  test("kad vlasnik odbije rezervaciju, javlja se i igračima termina", async () => {
    const [owner, organizer, player] = [await createUser(), await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const match = (await createWithReservation(venue, organizer)).body.match;
    await addPlayers(match, [player]);

    await api.post(`/api/reservations/${match.reservation_id}/reject`).set(auth(owner)).send({ reason: "Turnir" });

    const playerNotes = await messagesOf(player);
    expect(playerNotes).toHaveLength(1);
    expect(playerNotes[0]).toMatchObject({ match_id: match.id });
    expect(playerNotes[0].message).toMatch(/nije prihvatio rezervaciju terena za termin/);

    const organizerNotes = await messagesOf(organizer);
    expect(organizerNotes).toHaveLength(1);
    expect(organizerNotes[0].message).toMatch(/Rezervacija nije prihvaćena/);
  });

  test("vlasnik vidi koliko je igrača prijavljeno na termin uz rezervaciju", async () => {
    const [owner, organizer, a, b] = [await createUser(), await createUser(), await createUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const match = (await createWithReservation(venue, organizer)).body.match;
    await addPlayers(match, [a, b]);

    const res = await api.get("/api/reservations/owner").set(auth(owner));

    expect(res.body.reservations[0]).toMatchObject({ match_players: 2, match_max_players: 10 });
  });
});
