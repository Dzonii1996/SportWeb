const fs = require("fs");
const path = require("path");
const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  createMatch,
  makeAdmin,
  createVenue,
} = require("./helpers");
const {
  createSeriesForMatch,
  generateNextOccurrences,
} = require("../utils/series");

// Slike koje su testovi poslali; brišu se sa diska na kraju
const uploadedPaths = [];

beforeEach(resetDb);
afterAll(async () => {
  uploadedPaths.forEach((p) => fs.rmSync(path.join(__dirname, "..", p), { force: true }));
  await pool.end();
});

const venueBody = (overrides = {}) => ({
  name: "SC Sunce",
  address: "Kralja Petra 10",
  latitude: 42.89,
  longitude: 20.87,
  sports: ["Fudbal", "Košarka"],
  surface: "Veštačka trava",
  indoor: false,
  price_per_hour: 3000,
  working_hours: "Svaki dan 8-23h",
  phone: "+381 64 123 456",
  description: "Osvetljen teren.",
  ...overrides,
});

const matchBody = (overrides = {}) => ({
  sport: "Fudbal",
  location: "Ručno uneto",
  match_date: dateIn(5),
  match_time: "20:00",
  max_players: 10,
  ...overrides,
});

const venueNotifications = async (user) =>
  (
    await pool.query(
      "SELECT message, venue_id FROM notifications WHERE user_id = $1 ORDER BY id",
      [user.id]
    )
  ).rows;

const attachImages = (req, count, type = "image/png") => {
  for (let i = 0; i < count; i++) {
    req.attach("images", Buffer.from("slika"), {
      filename: `teren${i}.png`,
      contentType: type,
    });
  }

  return req;
};

const uploadImages = async (venueId, user, count = 1) => {
  const res = await attachImages(
    api.post(`/api/venues/${venueId}/images`).set(auth(user)),
    count
  );

  (res.body.images || []).forEach((img) => uploadedPaths.push(img.path));

  return res;
};

describe("admin", () => {
  test("status pokazuje ko je admin i koliko predloga čeka", async () => {
    const [admin, user] = [await createUser(), await createUser()];
    await makeAdmin(admin);
    await createVenue({ status: "pending" });

    const asAdmin = await api.get("/api/venues/admin/status").set(auth(admin));
    const asUser = await api.get("/api/venues/admin/status").set(auth(user));

    expect(asAdmin.body).toMatchObject({ is_admin: true, pending_count: 1 });
    expect(asUser.body).toMatchObject({ is_admin: false, pending_count: 0 });
  });

  test("email iz ADMIN_EMAILS je admin", async () => {
    const user = await createUser();
    const { rows } = await pool.query("SELECT email FROM users WHERE id = $1", [user.id]);
    process.env.ADMIN_EMAILS = ` drugi@test.rs, ${rows[0].email.toUpperCase()} `;

    try {
      const res = await api.get("/api/venues/admin/status").set(auth(user));
      expect(res.body.is_admin).toBe(true);
    } finally {
      delete process.env.ADMIN_EMAILS;
    }
  });

  test("admin dodaje teren koji je odmah odobren", async () => {
    const admin = await createUser();
    await makeAdmin(admin);

    const res = await api.post("/api/venues").set(auth(admin)).send(venueBody());

    expect(res.status).toBe(201);
    expect(res.body.venue).toMatchObject({
      status: "approved",
      sports: ["Fudbal", "Košarka"],
      price_per_hour: 3000,
    });
  });

  test("običan korisnik ne može da menja, briše ni odobrava terene", async () => {
    const user = await createUser();
    const venue = await createVenue({ status: "pending" });

    const update = await api.put(`/api/venues/${venue.id}`).set(auth(user)).send(venueBody());
    const remove = await api.delete(`/api/venues/${venue.id}`).set(auth(user));
    const approve = await api.post(`/api/venues/${venue.id}/approve`).set(auth(user));
    const list = await api.get("/api/venues/admin/list").set(auth(user));

    expect([update.status, remove.status, approve.status, list.status]).toEqual([403, 403, 403, 403]);
    expect((await pool.query("SELECT status FROM venues")).rows[0].status).toBe("pending");
  });

  test("bez prijave nema predloga", async () => {
    const res = await api.post("/api/venues").send(venueBody());

    expect(res.status).toBe(401);
  });

  test("admin menja i briše teren; termini na njemu ostaju bez terena", async () => {
    const [admin, owner] = [await createUser(), await createUser()];
    await makeAdmin(admin);
    const venue = await createVenue();
    const match = await createMatch(owner);
    await pool.query("UPDATE matches SET venue_id = $1 WHERE id = $2", [venue.id, match.id]);

    const update = await api
      .put(`/api/venues/${venue.id}`)
      .set(auth(admin))
      .send(venueBody({ name: "Novo ime", indoor: true, price_per_hour: "" }));

    expect(update.status).toBe(200);
    expect(update.body.venue).toMatchObject({ name: "Novo ime", indoor: true, price_per_hour: null });

    const remove = await api.delete(`/api/venues/${venue.id}`).set(auth(admin));
    const left = await pool.query("SELECT venue_id FROM matches WHERE id = $1", [match.id]);

    expect(remove.status).toBe(200);
    expect(left.rows[0].venue_id).toBeNull();
  });
});

describe("predlozi", () => {
  test("predlog korisnika čeka odobrenje, a admini dobijaju notifikaciju", async () => {
    const [admin, user] = [await createUser(), await createUser()];
    await makeAdmin(admin);

    const res = await api.post("/api/venues").set(auth(user)).send(venueBody());

    expect(res.status).toBe(201);
    expect(res.body.venue.status).toBe("pending");
    expect(res.body.venue.suggested_by).toBe(user.id);

    const notes = await venueNotifications(admin);
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toMatch(/Nov predlog terena: SC Sunce/);
    expect(notes[0].venue_id).toBe(res.body.venue.id);
    expect(await venueNotifications(user)).toHaveLength(0);
  });

  test("odobravanje obaveštava predlagača i stavlja teren na listu", async () => {
    const [admin, user] = [await createUser(), await createUser()];
    await makeAdmin(admin);
    const venue = await createVenue({ status: "pending", suggestedBy: user });

    const res = await api.post(`/api/venues/${venue.id}/approve`).set(auth(admin));
    const list = await api.get("/api/venues");

    expect(res.status).toBe(200);
    expect(list.body.venues.map((v) => v.id)).toEqual([venue.id]);

    const notes = await venueNotifications(user);
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toMatch(/je odobren/);
    expect(notes[0].venue_id).toBe(venue.id);
  });

  test("odbijanje šalje razlog predlagaču", async () => {
    const [admin, user] = [await createUser(), await createUser()];
    await makeAdmin(admin);
    const venue = await createVenue({ status: "pending", suggestedBy: user });

    const res = await api
      .post(`/api/venues/${venue.id}/reject`)
      .set(auth(admin))
      .send({ reason: "Teren već postoji." });

    expect(res.body.venue).toMatchObject({ status: "rejected", rejection_reason: "Teren već postoji." });

    const notes = await venueNotifications(user);
    expect(notes[0].message).toMatch(/nije odobren\. Razlog: Teren već postoji\./);
  });

  test("admin vidi listu predloga sa imenom predlagača", async () => {
    const [admin, user] = [await createUser(), await createUser("Marko")];
    await makeAdmin(admin);
    await createVenue({ status: "pending", suggestedBy: user });
    await createVenue({ name: "Odobren" });

    const res = await api.get("/api/venues/admin/list?status=pending").set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.body.venues).toHaveLength(1);
    expect(res.body.venues[0].suggested_by_name).toBe("Marko");
  });

  test.each([
    ["prazan naziv", { name: "" }, /Naziv/],
    ["kratka adresa", { address: "x" }, /Adresa/],
    ["bez tačke na mapi", { latitude: "", longitude: "" }, /mapi/],
    ["neispravne koordinate", { latitude: 200 }, /lokacija/],
    ["bez sporta", { sports: [] }, /sport/],
    ["nepoznat sport", { sports: ["Tenis"] }, /sport/],
    ["nepoznata podloga", { surface: "Led" }, /podloga/],
    ["negativna cena", { price_per_hour: -1 }, /Cena po satu/],
    ["telefon sa slovima", { phone: "zovi me" }, /Telefon/],
    ["predugačak opis", { description: "a".repeat(2001) }, /Opis/],
  ])("odbijen je predlog: %s", async (_, overrides, message) => {
    const user = await createUser();

    const res = await api.post("/api/venues").set(auth(user)).send(venueBody(overrides));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });
});

describe("vidljivost i filteri", () => {
  test("na listi su samo odobreni tereni", async () => {
    await createVenue({ name: "A odobren" });
    await createVenue({ name: "B na čekanju", status: "pending" });
    await createVenue({ name: "C odbijen", status: "rejected" });

    const res = await api.get("/api/venues");

    expect(res.body.venues.map((v) => v.name)).toEqual(["A odobren"]);
  });

  test("neodobren teren vide samo admin i predlagač", async () => {
    const [admin, suggester, other] = [await createUser(), await createUser(), await createUser()];
    await makeAdmin(admin);
    const venue = await createVenue({ status: "pending", suggestedBy: suggester });

    const anonymous = await api.get(`/api/venues/${venue.id}`);
    const asOther = await api.get(`/api/venues/${venue.id}`).set(auth(other));
    const asSuggester = await api.get(`/api/venues/${venue.id}`).set(auth(suggester));
    const asAdmin = await api.get(`/api/venues/${venue.id}`).set(auth(admin));

    expect([anonymous.status, asOther.status]).toEqual([404, 404]);
    expect(asSuggester.status).toBe(200);
    expect(asSuggester.body.can_edit).toBe(false);
    expect(asSuggester.body.can_edit_images).toBe(true);
    expect(asAdmin.body.can_edit).toBe(true);
  });

  test("filter po sportu i unutra/napolju", async () => {
    await createVenue({ name: "Fudbal napolju", sports: ["Fudbal"] });
    await createVenue({ name: "Hala", sports: ["Fudbal", "Košarka"], indoor: true });
    await createVenue({ name: "Koš napolju", sports: ["Košarka"] });

    const names = async (query) =>
      (await api.get(`/api/venues${query}`)).body.venues.map((v) => v.name);

    expect(await names("?sport=Košarka")).toEqual(["Hala", "Koš napolju"]);
    expect(await names("?indoor=true")).toEqual(["Hala"]);
    expect(await names("?sport=Fudbal&indoor=false")).toEqual(["Fudbal napolju"]);
    expect((await api.get("/api/venues?sport=Tenis")).status).toBe(400);
  });

  test("stranica terena prikazuje predstojeće javne termine na njemu", async () => {
    const owner = await createUser();
    const venue = await createVenue();
    const upcoming = await createMatch(owner);
    const past = await createMatch(owner, { startsInHours: -3 });
    const hidden = await createMatch(owner);
    await createMatch(owner);
    await pool.query("UPDATE matches SET venue_id = $1 WHERE id = ANY($2)", [
      venue.id,
      [upcoming.id, past.id, hidden.id],
    ]);
    await pool.query("UPDATE matches SET is_private = true, share_token = 'k' WHERE id = $1", [hidden.id]);

    const res = await api.get(`/api/venues/${venue.id}`);
    const list = await api.get("/api/venues");

    expect(res.body.matches.map((m) => m.id)).toEqual([upcoming.id]);
    expect(res.body.matches[0].share_token).toBeUndefined();
    expect(list.body.venues[0].upcoming_matches).toBe(1);
  });
});

describe("termin na terenu", () => {
  test("izbor terena popunjava lokaciju i koordinate", async () => {
    const owner = await createUser();
    const venue = await createVenue({ name: "SC Sunce", latitude: 43.1, longitude: 21.2 });

    const res = await api
      .post("/api/matches")
      .set(auth(owner))
      .send(matchBody({ venue_id: venue.id, location: "nešto drugo", field_price: 2500 }));

    expect(res.status).toBe(201);
    expect(res.body.match).toMatchObject({
      venue_id: venue.id,
      location: "SC Sunce",
      latitude: 43.1,
      longitude: 21.2,
      field_price: 2500,
    });

    const got = await api.get(`/api/matches/${res.body.match.id}`);
    expect(got.body.match.venue_name).toBe("SC Sunce");
  });

  test("ručno uneta lokacija nema teren", async () => {
    const owner = await createUser();

    const res = await api.post("/api/matches").set(auth(owner)).send(matchBody());

    expect(res.status).toBe(201);
    expect(res.body.match.venue_id).toBeNull();
    expect(res.body.match.location).toBe("Ručno uneto");
  });

  test("teren mora biti odobren i za izabrani sport", async () => {
    const owner = await createUser();
    const pending = await createVenue({ status: "pending" });
    const basketball = await createVenue({ sports: ["Košarka"] });

    const notApproved = await api
      .post("/api/matches")
      .set(auth(owner))
      .send(matchBody({ venue_id: pending.id }));
    const wrongSport = await api
      .post("/api/matches")
      .set(auth(owner))
      .send(matchBody({ venue_id: basketball.id }));

    expect(notApproved.status).toBe(400);
    expect(wrongSport.status).toBe(400);
    expect(wrongSport.body.message).toMatch(/nije za fudbal/);
  });

  test("izmena menja teren ili prelazi na ručni unos", async () => {
    const owner = await createUser();
    const [first, second] = [await createVenue({ name: "Prvi" }), await createVenue({ name: "Drugi" })];
    const created = await api
      .post("/api/matches")
      .set(auth(owner))
      .send(matchBody({ venue_id: first.id }));
    const id = created.body.match.id;

    const toSecond = await api
      .put(`/api/matches/${id}`)
      .set(auth(owner))
      .send(matchBody({ venue_id: second.id }));
    expect(toSecond.body.match).toMatchObject({ venue_id: second.id, location: "Drugi" });

    const manual = await api
      .put(`/api/matches/${id}`)
      .set(auth(owner))
      .send(matchBody({ venue_id: null, location: "Školsko igralište" }));
    expect(manual.body.match).toMatchObject({ venue_id: null, location: "Školsko igralište" });
  });

  test("termin zadržava teren i kad teren više nije odobren", async () => {
    const owner = await createUser();
    const venue = await createVenue();
    const created = await api
      .post("/api/matches")
      .set(auth(owner))
      .send(matchBody({ venue_id: venue.id }));
    await pool.query("UPDATE venues SET status = 'rejected' WHERE id = $1", [venue.id]);

    const res = await api
      .put(`/api/matches/${created.body.match.id}`)
      .set(auth(owner))
      .send(matchBody({ venue_id: venue.id, max_players: 12 }));

    expect(res.status).toBe(200);
    expect(res.body.match.venue_id).toBe(venue.id);
  });

  test("ponavljajući termin prenosi teren u sledeći", async () => {
    const owner = await createUser();
    const venue = await createVenue();
    const match = await createMatch(owner, { startsInHours: -1 });
    await pool.query("UPDATE matches SET venue_id = $1 WHERE id = $2", [venue.id, match.id]);
    await createSeriesForMatch(pool, { ...match, venue_id: venue.id });

    await generateNextOccurrences();

    const next = await pool.query(
      "SELECT venue_id FROM matches WHERE id <> $1",
      [match.id]
    );
    expect(next.rows).toEqual([{ venue_id: venue.id }]);
  });

  test("izmena termina u seriji menja teren i sledećim terminima", async () => {
    const owner = await createUser();
    const venue = await createVenue();
    const created = await api
      .post("/api/matches")
      .set(auth(owner))
      .send(matchBody({ repeat_weekly: true }));

    await api
      .put(`/api/matches/${created.body.match.id}`)
      .set(auth(owner))
      .send(matchBody({ venue_id: venue.id }));

    const series = await pool.query("SELECT venue_id, location FROM match_series");
    expect(series.rows[0]).toEqual({ venue_id: venue.id, location: venue.name });
  });
});

describe("slike terena", () => {
  test("admin dodaje više slika, prva je naslovna", async () => {
    const admin = await createUser();
    await makeAdmin(admin);
    const venue = await createVenue();

    const res = await uploadImages(venue.id, admin, 2);

    expect(res.status).toBe(201);
    expect(res.body.images).toHaveLength(2);
    expect(res.body.images[0].path).toMatch(/^\/uploads\/.+\.png$/);

    const list = await api.get("/api/venues");
    expect(list.body.venues[0].cover_image).toBe(res.body.images[0].path);
  });

  test("predlagač dodaje slike dok predlog čeka, drugi ne mogu", async () => {
    const [suggester, other] = [await createUser(), await createUser()];
    const venue = await createVenue({ status: "pending", suggestedBy: suggester });

    expect((await uploadImages(venue.id, suggester)).status).toBe(201);
    expect((await uploadImages(venue.id, other)).status).toBe(403);

    await pool.query("UPDATE venues SET status = 'approved' WHERE id = $1", [venue.id]);
    expect((await uploadImages(venue.id, suggester)).status).toBe(403);
  });

  test("najviše 6 slika po terenu", async () => {
    const admin = await createUser();
    await makeAdmin(admin);
    const venue = await createVenue();

    expect((await uploadImages(venue.id, admin, 5)).status).toBe(201);

    const res = await uploadImages(venue.id, admin, 2);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/najviše 6/);
  });

  test("prima samo slike", async () => {
    const admin = await createUser();
    await makeAdmin(admin);
    const venue = await createVenue();

    const res = await attachImages(
      api.post(`/api/venues/${venue.id}/images`).set(auth(admin)),
      1,
      "text/html"
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/samo slike/);
  });

  test("brisanje slike uklanja i fajl", async () => {
    const admin = await createUser();
    await makeAdmin(admin);
    const venue = await createVenue();
    const [image] = (await uploadImages(venue.id, admin)).body.images;
    const file = path.join(__dirname, "..", image.path);

    expect(fs.existsSync(file)).toBe(true);

    const res = await api.delete(`/api/venues/${venue.id}/images/${image.id}`).set(auth(admin));

    expect(res.status).toBe(200);
    // Fajl se briše asinhrono
    await new Promise((r) => setTimeout(r, 50));
    expect(fs.existsSync(file)).toBe(false);
  });
});
