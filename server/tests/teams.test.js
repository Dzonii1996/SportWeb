const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  createMatch,
  addPlayers,
  notificationsOf,
} = require("./helpers");
const { assignTeams } = require("../services/teamService");

beforeEach(resetDb);
afterAll(() => pool.end());

const split = (match, user, mode) =>
  api.post(`/api/matches/${match.id}/teams`).set(auth(user)).send({ mode });

const teamsOf = async (match) =>
  (await api.get(`/api/matches/${match.id}/players`)).body.players;

const setup = async (count = 6) => {
  const owner = await createUser();
  const players = await Promise.all([...Array(count)].map(() => createUser()));
  const match = await createMatch(owner);
  await addPlayers(match, players);

  return { owner, players, match };
};

describe("podela na timove", () => {
  test.each(["random", "balanced"])("%s: svi igrači su u timu, timovi su jednaki", async (mode) => {
    const { owner, match } = await setup(6);

    const res = await split(match, owner, mode);
    const players = await teamsOf(match);

    expect(res.body.success).toBe(true);
    expect(players.filter((p) => p.team === "A")).toHaveLength(3);
    expect(players.filter((p) => p.team === "B")).toHaveLength(3);
  });

  test("neparan broj: razlika je najviše jedan igrač", async () => {
    const { owner, match } = await setup(5);

    await split(match, owner, "random");
    const players = await teamsOf(match);
    const a = players.filter((p) => p.team === "A").length;

    expect(Math.abs(a - (5 - a))).toBe(1);
  });

  test("samo kreator može da deli", async () => {
    const { players, match } = await setup(4);

    const res = await split(match, players[0], "random");

    expect(res.status).toBe(403);
  });

  test("potrebna su bar dva igrača", async () => {
    const { owner, match } = await setup(1);

    const res = await split(match, owner, "random");

    expect(res.body.message).toBe("Za podelu su potrebna bar dva igrača.");
  });

  test("nepoznat način je odbijen", async () => {
    const { owner, match } = await setup(4);

    expect((await split(match, owner, "po visini")).status).toBe(400);
  });

  test("igrači dobijaju notifikaciju, kreator ne", async () => {
    const { owner, players, match } = await setup(2);

    await split(match, owner, "random");

    expect((await notificationsOf(players[0]))[0].message).toMatch(/^👕 Timovi su podeljeni/);
    expect(await notificationsOf(owner)).toHaveLength(0);
  });

  test("ko se prijavi posle podele nema tim", async () => {
    const { owner, match } = await setup(4);
    await split(match, owner, "random");

    const late = await createUser();
    await api.post(`/api/matches/${match.id}/join`).set(auth(late));

    const players = await teamsOf(match);

    expect(players.find((p) => p.id === late.id).team).toBeNull();
  });
});

describe("ujednačena podela", () => {
  test("najbolje ocenjeni nisu u istom timu", () => {
    const players = [
      { id: 1, score: 10 },
      { id: 2, score: 9 },
      { id: 3, score: 2 },
      { id: 4, score: 1 },
    ];

    const teams = assignTeams(players, "balanced");
    const teamOf = (id) => teams.find((t) => t.id === id).team;

    // Zmija A B B A: 1 i 4 zajedno, 2 i 3 zajedno
    expect(teamOf(1)).not.toBe(teamOf(2));
    expect(teamOf(1)).toBe(teamOf(4));
    expect(teamOf(2)).toBe(teamOf(3));
  });

  test("zbir ocena u timovima je blizak", () => {
    const players = [8, 7, 6, 5, 4, 3, 2, 1].map((score, i) => ({ id: i + 1, score }));

    const teams = assignTeams(players, "balanced");
    const sum = (team) =>
      teams
        .filter((t) => t.team === team)
        .reduce((s, t) => s + players.find((p) => p.id === t.id).score, 0);

    expect(sum("A")).toBe(sum("B"));
  });
});
