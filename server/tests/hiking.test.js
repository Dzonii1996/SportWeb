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
const {
  createSeriesForMatch,
  generateNextOccurrences,
} = require("../utils/series");
const { parseHike } = require("../utils/fields");

beforeEach(resetDb);
afterAll(() => pool.end());

const hike = (overrides = {}) => ({
  route: "Rogozna",
  difficulty: "medium",
  distance_km: 12.5,
  ascent_m: 600,
  duration_hours: 5,
  gear: "Voda i jakna",
  ...overrides,
});

const body = (overrides = {}) => ({
  sport: "Planinarenje",
  location: "Parking kod mosta",
  match_date: dateIn(5),
  match_time: "08:00",
  max_players: 10,
  hike: hike(),
  ...overrides,
});

const create = (user, overrides) =>
  api.post("/api/matches").set(auth(user)).send(body(overrides));

describe("termin za planinarenje", () => {
  test("čuva podatke o stazi i prikazuje se na listi", async () => {
    const user = await createUser();

    const res = await create(user);

    expect(res.status).toBe(201);
    expect(res.body.match.hike).toEqual(hike());

    const list = await api.get("/api/matches");
    expect(list.body.matches[0]).toMatchObject({ sport: "Planinarenje", hike: hike() });
  });

  test("prazna polja nisu obavezna", async () => {
    const user = await createUser();

    const res = await create(user, {
      hike: hike({ distance_km: "", ascent_m: "", duration_hours: "", gear: " " }),
    });

    expect(res.status).toBe(201);
    expect(res.body.match.hike).toEqual({
      route: "Rogozna",
      difficulty: "medium",
      distance_km: null,
      ascent_m: null,
      duration_hours: null,
      gear: null,
    });
  });

  test.each([
    ["bez staze", { route: "" }, /staze ili vrha/],
    ["bez težine", { difficulty: "" }, /težinu/],
    ["nepoznata težina", { difficulty: "ekstremno" }, /težinu/],
    ["negativna dužina", { distance_km: -1 }, /dužina/],
    ["previše uspona", { ascent_m: 10000 }, /uspon/],
    ["nula sati", { duration_hours: 0 }, /trajanje/],
    ["predugačka oprema", { gear: "a".repeat(501) }, /opreme/],
  ])("odbijeno: %s", async (_, overrides, message) => {
    const user = await createUser();

    const res = await create(user, { hike: hike(overrides) });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  test("planinarenje traži podatke o stazi", async () => {
    const user = await createUser();

    const res = await create(user, { hike: undefined });

    expect(res.status).toBe(400);
  });

  test("drugi sportovi nemaju podatke o stazi", async () => {
    const user = await createUser();

    const res = await create(user, { sport: "Fudbal" });

    expect(res.status).toBe(201);
    expect(res.body.match.hike).toBeNull();
  });

  test("izmena menja stazu", async () => {
    const user = await createUser();
    const { match } = (await create(user)).body;

    const res = await api
      .put(`/api/matches/${match.id}`)
      .set(auth(user))
      .send(body({ hike: hike({ route: "Kopaonik", difficulty: "hard" }) }));

    expect(res.status).toBe(200);
    expect(res.body.match.hike).toMatchObject({ route: "Kopaonik", difficulty: "hard" });
  });

  test("nema terena iz kataloga", async () => {
    const user = await createUser();
    const venue = await createVenue({ sports: ["Fudbal"] });

    const res = await create(user, { venue_id: venue.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nije za planinarenje/);
  });

  test("nema timova ni rezultata", async () => {
    const [user, other] = [await createUser(), await createUser()];
    const { match } = (await create(user)).body;
    await addPlayers(match, [user, other]);
    await pool.query("UPDATE matches SET match_date = CURRENT_DATE - 1 WHERE id = $1", [match.id]);

    const teams = await api.post(`/api/matches/${match.id}/teams`).set(auth(user)).send({ mode: "random" });
    const result = await api
      .put(`/api/matches/${match.id}/result`)
      .set(auth(user))
      .send({ score_a: 1, score_b: 0 });

    expect(teams.status).toBe(400);
    expect(teams.body.message).toMatch(/nema timove/);
    expect(result.status).toBe(400);
    expect(result.body.message).toMatch(/nema rezultat/);
  });

  test("nije deo terena, turnira ni rang liste", async () => {
    const admin = await createUser();
    await pool.query("UPDATE users SET is_admin = true WHERE id = $1", [admin.id]);

    const venue = await api.post("/api/venues").set(auth(admin)).send({
      name: "Staza",
      address: "Planina",
      latitude: 42.9,
      longitude: 20.9,
      sports: ["Planinarenje"],
    });
    const tournament = await api.post("/api/tournaments").set(auth(admin)).send({
      name: "Pohod",
      sport: "Planinarenje",
      format: "league",
      location: "Planina",
      start_date: dateIn(10),
      max_teams: 4,
      max_roster: 5,
    });
    const leaderboard = await api.get(`/api/users/leaderboard?sport=${encodeURIComponent("Planinarenje")}`);

    expect([venue.status, tournament.status, leaderboard.status]).toEqual([400, 400, 400]);
  });

  test("ponavljajući termin prenosi stazu u sledeći", async () => {
    const user = await createUser();
    const { match } = (await create(user)).body;
    await pool.query("UPDATE matches SET match_date = CURRENT_DATE - 1 WHERE id = $1", [match.id]);
    const current = (await pool.query("SELECT * FROM matches WHERE id = $1", [match.id])).rows[0];
    await createSeriesForMatch(pool, current);

    await generateNextOccurrences();

    const next = await pool.query("SELECT hike FROM matches WHERE id <> $1", [match.id]);
    expect(next.rows[0].hike).toEqual(hike());
  });

  test("engleski prevod poruke", async () => {
    const user = await createUser();

    const res = await api
      .post("/api/matches")
      .set(auth(user))
      .set("Accept-Language", "en")
      .send(body({ hike: hike({ route: "" }) }));

    expect(res.body.message).toMatch(/trail or peak/);
  });

  test("parseHike ne dira druge sportove", () => {
    expect(parseHike({ sport: "Tenis", hike: hike() })).toEqual({ hike: null });
  });
});
