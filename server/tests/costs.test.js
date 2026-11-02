const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  createMatch,
  addPlayers,
} = require("./helpers");
const {
  createSeriesForMatch,
  generateNextOccurrences,
} = require("../utils/series");

beforeEach(resetDb);
afterAll(() => pool.end());

const body = (overrides = {}) => ({
  sport: "Fudbal",
  location: "Hala",
  match_date: dateIn(5),
  match_time: "20:00",
  max_players: 10,
  ...overrides,
});

const players = async (match) =>
  (await api.get(`/api/matches/${match.id}/players`)).body.players;

const markPaid = (match, by, player, paid = true) =>
  api
    .put(`/api/matches/${match.id}/players/${player.id}/paid`)
    .set(auth(by))
    .send({ paid });

describe("cena terena", () => {
  test("čuva se pri kreiranju i vraća u terminu", async () => {
    const owner = await createUser();

    const res = await api.post("/api/matches").set(auth(owner)).send(body({ field_price: 3000 }));
    const got = await api.get(`/api/matches/${res.body.match.id}`);

    expect(got.body.match.field_price).toBe(3000);
  });

  test("prazna cena znači da nije zadata", async () => {
    const owner = await createUser();

    const res = await api.post("/api/matches").set(auth(owner)).send(body({ field_price: "" }));

    expect(res.status).toBe(201);
    expect(res.body.match.field_price).toBeNull();
  });

  test.each([[-5], [1.5], ["abc"], [2000000]])("neispravna cena %p je odbijena", async (price) => {
    const owner = await createUser();

    const res = await api.post("/api/matches").set(auth(owner)).send(body({ field_price: price }));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Cena terena/);
  });

  test("izmena menja i uklanja cenu", async () => {
    const owner = await createUser();
    const created = await api.post("/api/matches").set(auth(owner)).send(body({ field_price: 3000 }));
    const id = created.body.match.id;

    await api.put(`/api/matches/${id}`).set(auth(owner)).send(body({ field_price: 3600 }));
    expect((await api.get(`/api/matches/${id}`)).body.match.field_price).toBe(3600);

    await api.put(`/api/matches/${id}`).set(auth(owner)).send(body({ field_price: "" }));
    expect((await api.get(`/api/matches/${id}`)).body.match.field_price).toBeNull();
  });

  test("ponavljajući termin prenosi cenu u sledeći", async () => {
    const owner = await createUser();
    const match = await createMatch(owner, { startsInHours: -1 });
    await pool.query("UPDATE matches SET field_price = 2400 WHERE id = $1", [match.id]);
    match.field_price = 2400;
    const seriesId = await createSeriesForMatch(pool, match);

    await generateNextOccurrences();

    const next = await pool.query(
      "SELECT field_price FROM matches WHERE series_id = $1 AND id <> $2",
      [seriesId, match.id]
    );

    expect(next.rows[0].field_price).toBe(2400);
  });
});

describe("ko je platio", () => {
  const setup = async () => {
    const [owner, a, b] = [await createUser(), await createUser(), await createUser()];
    const match = await createMatch(owner);
    await addPlayers(match, [a, b]);

    return { owner, a, b, match };
  };

  test("kreator označava igrača kao platio", async () => {
    const { owner, a, match } = await setup();

    const res = await markPaid(match, owner, a);
    const list = await players(match);

    expect(res.body.success).toBe(true);
    expect(list.find((p) => p.id === a.id).paid).toBe(true);
  });

  test("oznaka može da se skine", async () => {
    const { owner, a, match } = await setup();

    await markPaid(match, owner, a, true);
    await markPaid(match, owner, a, false);

    expect((await players(match)).find((p) => p.id === a.id).paid).toBe(false);
  });

  test("igrač ne može sam sebe da označi", async () => {
    const { a, match } = await setup();

    expect((await markPaid(match, a, a)).status).toBe(403);
  });

  test("ne može se označiti neko ko nije prijavljen", async () => {
    const { owner, match } = await setup();

    const res = await markPaid(match, owner, await createUser());

    expect(res.body.message).toBe("Korisnik nije prijavljen na termin.");
  });

  test("ponovna prijava briše oznaku plaćanja", async () => {
    const { owner, a, match } = await setup();
    await markPaid(match, owner, a);

    await api.delete(`/api/matches/${match.id}/leave`).set(auth(a));
    await api.post(`/api/matches/${match.id}/join`).set(auth(a));

    expect((await players(match)).find((p) => p.id === a.id).paid).toBe(false);
  });
});
