const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  makeAdmin,
  createVenue,
  createMatch,
  addPlayers,
} = require("./helpers");
const { judgeResult, computeStandings } = require("../utils/tournament");
const { translate } = require("../utils/i18n");

beforeEach(resetDb);
afterAll(() => pool.end());

const matchBody = (overrides = {}) => ({
  location: "Teren",
  match_date: dateIn(5),
  match_time: "20:00",
  max_players: 4,
  ...overrides,
});

describe("tenis i odbojka", () => {
  test.each([["Tenis"], ["Odbojka"]])("termin može da se napravi za sport %s", async (sport) => {
    const owner = await createUser();

    const res = await api.post("/api/matches").set(auth(owner)).send(matchBody({ sport }));

    expect(res.status).toBe(201);
    expect(res.body.match.sport).toBe(sport);
  });

  test("nepoznat sport je i dalje odbijen", async () => {
    const owner = await createUser();

    const res = await api.post("/api/matches").set(auth(owner)).send(matchBody({ sport: "Hokej" }));

    expect(res.status).toBe(400);
  });

  test("teren prima nove sportove i podloge, a filter ih nalazi", async () => {
    const admin = await createUser();
    await makeAdmin(admin);

    const res = await api.post("/api/venues").set(auth(admin)).send({
      name: "Teniski klub",
      address: "Ulica 1",
      latitude: 42.89,
      longitude: 20.87,
      sports: ["Tenis", "Odbojka"],
      surface: "Šljaka",
    });
    await createVenue({ name: "Fudbalski", sports: ["Fudbal"] });

    expect(res.status).toBe(201);

    const list = await api.get(`/api/venues?sport=${encodeURIComponent("Tenis")}`);
    expect(list.body.venues.map((v) => v.name)).toEqual(["Teniski klub"]);
  });

  test.each([
    ["Tenis", /nije za tenis/, /not for tennis/],
    ["Odbojka", /nije za odbojku/, /not for volleyball/],
  ])("termin za sport %s ne može na teren koji nije za njega", async (sport, sr, en) => {
    const owner = await createUser();
    const venue = await createVenue({ sports: ["Fudbal"] });
    const body = matchBody({ sport, venue_id: venue.id });

    const res = await api.post("/api/matches").set(auth(owner)).send(body);
    const english = await api
      .post("/api/matches")
      .set(auth(owner))
      .set("Accept-Language", "en")
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(sr);
    expect(english.body.message).toMatch(en);
  });

  test.each([["Tenis"], ["Odbojka"]])("%s nema nerešeno, ni u ligi ni u kupu", (sport) => {
    const base = { sport, scoreA: 1, scoreB: 1 };

    expect(judgeResult({ ...base, format: "league" }).error).toMatch(/osvojene setove/);
    expect(judgeResult({ ...base, format: "knockout" }).error).toMatch(/osvojene setove/);
    expect(judgeResult({ ...base, format: "league", scoreA: 3 }).winner).toBe("a");
  });

  test.each([["Tenis"], ["Odbojka"]])("%s: 2 boda za pobedu, 0 za poraz, set-razlika", (sport) => {
    const teams = [{ id: 1, name: "A" }, { id: 2, name: "B" }];

    const table = computeStandings(
      teams,
      [{ team_a_id: 1, team_b_id: 2, score_a: 3, score_b: 1 }],
      sport
    );

    expect(table.map((r) => [r.name, r.points, r.diff])).toEqual([["A", 2, 2], ["B", 0, -2]]);
  });

  test("opis termina se prevodi i za nove sportove", () => {
    expect(
      translate("❌ Termin je otkazan: Tenis, Klub, 10. 11. 2026. u 18:00.", "en")
    ).toMatch(/Tennis, Klub, 10\/11\/2026 at 18:00/);
  });
});

describe("rang lista po sportu", () => {
  // Odigran termin: "winner" u timu A pobeđuje "loser" u timu B
  const played = async (sport, winner, loser) => {
    const match = await createMatch(winner, { startsInHours: -3 });
    await addPlayers(match, [winner, loser]);
    await pool.query(
      "UPDATE matches SET sport = $2, score_a = 3, score_b = 1 WHERE id = $1",
      [match.id, sport]
    );
    await pool.query("UPDATE match_players SET team = 'A' WHERE match_id = $1 AND user_id = $2", [match.id, winner.id]);
    await pool.query("UPDATE match_players SET team = 'B' WHERE match_id = $1 AND user_id = $2", [match.id, loser.id]);
  };

  const table = async (query = "") =>
    (await api.get(`/api/users/leaderboard${query}`)).body.players.map((p) => [p.name, p.points]);

  test("svaki sport ima svoju listu", async () => {
    const [a, b] = [await createUser("Ana"), await createUser("Boris")];
    await played("Fudbal", a, b);
    await played("Tenis", b, a);
    await played("Tenis", b, a);

    expect(await table("?sport=Fudbal")).toEqual([["Ana", 3], ["Boris", 0]]);
    expect(await table("?sport=Tenis")).toEqual([["Boris", 6], ["Ana", 0]]);
    expect(await table("?sport=Odbojka")).toEqual([]);
  });

  test("bez sporta lista je zajednička, a nepoznat sport je odbijen", async () => {
    const [a, b] = [await createUser("Ana"), await createUser("Boris")];
    await played("Fudbal", a, b);
    await played("Tenis", b, a);

    expect((await table()).map((r) => r[1])).toEqual([3, 3]);
    expect((await api.get("/api/users/leaderboard?sport=Hokej")).status).toBe(400);
  });
});
