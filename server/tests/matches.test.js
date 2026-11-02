const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  createMatch,
  addPlayers,
  notificationsOf,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const valid = () => ({
  sport: "Fudbal",
  location: "Gradski stadion",
  match_date: dateIn(7),
  match_time: "18:00",
  max_players: 10,
});

describe("kreiranje termina", () => {
  test("ispravan termin se čuva, kreator iz tokena", async () => {
    const me = await createUser();

    const res = await api
      .post("/api/matches")
      .set(auth(me))
      .send({ ...valid(), user_id: 9999 });

    expect(res.status).toBe(201);
    expect(res.body.match.user_id).toBe(me.id);
  });

  test.each([
    ["godina 20026", { match_date: "20026-12-03" }, "Neispravan datum."],
    ["datum u prošlosti", { match_date: "2020-01-01" }, "Termin ne može biti u prošlosti."],
    ["za dve godine", { match_date: dateIn(800) }, "Termin može biti najviše godinu dana unapred."],
    ["31. februar", { match_date: "2027-02-31" }, "Neispravan datum ili vreme."],
    ["vreme 25:00", { match_time: "25:00" }, "Neispravan datum ili vreme."],
    ["100 igrača", { max_players: 100 }, "Broj igrača mora biti između 2 i 30."],
    ["nepoznat sport", { sport: "Tenis" }, "Nepoznat sport."],
    ["lokacija od razmaka", { location: "   " }, "Lokacija mora imati između 2 i 100 znakova."],
    ["samo jedna koordinata", { latitude: 42.88 }, "Neispravna lokacija na mapi."],
    ["koordinata van opsega", { latitude: 95, longitude: 20 }, "Neispravna lokacija na mapi."],
  ])("odbija: %s", async (_, change, message) => {
    const me = await createUser();

    const res = await api
      .post("/api/matches")
      .set(auth(me))
      .send({ ...valid(), ...change });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
  });

  test("čuva tačnu lokaciju na mapi", async () => {
    const me = await createUser();

    const res = await api
      .post("/api/matches")
      .set(auth(me))
      .send({ ...valid(), latitude: 42.8865, longitude: 20.8702 });

    expect(res.body.match.latitude).toBe(42.8865);
    expect(res.body.match.longitude).toBe(20.8702);
  });
});

describe("izmena i brisanje", () => {
  test("samo kreator može da izmeni termin", async () => {
    const [owner, other] = [await createUser(), await createUser()];
    const match = await createMatch(owner);

    const res = await api
      .put(`/api/matches/${match.id}`)
      .set(auth(other))
      .send(valid());

    expect(res.status).toBe(403);
  });

  test("broj mesta ne može ispod broja prijavljenih", async () => {
    const owner = await createUser();
    const players = [await createUser(), await createUser(), await createUser()];
    const match = await createMatch(owner);
    await addPlayers(match, players);

    const res = await api
      .put(`/api/matches/${match.id}`)
      .set(auth(owner))
      .send({ ...valid(), max_players: 2 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Na termin je već prijavljeno 3 igrača.");
  });

  test("promena vremena obaveštava igrače, ali ne i kreatora", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await createMatch(owner);
    await addPlayers(match, [player]);

    await api
      .put(`/api/matches/${match.id}`)
      .set(auth(owner))
      .send({ ...valid(), match_time: "19:30" });

    const notes = await notificationsOf(player);

    expect(notes).toHaveLength(1);
    expect(notes[0].message).toMatch(/^✏️ Termin je izmenjen: .*u 19:30 \(ranije:/);
    expect(notes[0].match_id).toBe(match.id);
    expect(await notificationsOf(owner)).toHaveLength(0);
  });

  test("promena samo broja mesta ne šalje obaveštenje", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const res = await api.post("/api/matches").set(auth(owner)).send(valid());
    const match = res.body.match;
    await addPlayers(match, [player]);

    await api
      .put(`/api/matches/${match.id}`)
      .set(auth(owner))
      .send({ ...valid(), max_players: 12 });

    expect(await notificationsOf(player)).toHaveLength(0);
  });

  test("otkazivanje obaveštava igrače, notifikacija ostaje bez linka", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await createMatch(owner);
    await addPlayers(match, [player]);

    const res = await api
      .delete(`/api/matches/${match.id}`)
      .set(auth(owner));

    expect(res.body.success).toBe(true);

    const notes = await notificationsOf(player);

    expect(notes).toHaveLength(1);
    expect(notes[0].message).toMatch(/^❌ Termin je otkazan/);
    expect(notes[0].match_id).toBeNull();
  });

  test("samo kreator može da obriše termin", async () => {
    const [owner, other] = [await createUser(), await createUser()];
    const match = await createMatch(owner);

    const res = await api
      .delete(`/api/matches/${match.id}`)
      .set(auth(other));

    expect(res.status).toBe(403);
  });
});
