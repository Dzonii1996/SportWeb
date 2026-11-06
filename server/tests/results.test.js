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
const { outcome } = require("../services/playerStatsService");

beforeEach(resetDb);
afterAll(() => pool.end());

const setResult = (match, user, score_a, score_b) =>
  api.put(`/api/matches/${match.id}/result`).set(auth(user)).send({ score_a, score_b });

const stats = async (user) => (await api.get(`/api/users/${user.id}`)).body.stats;

// Odigran termin sa timovima: a1, a2 u timu A, b1 u timu B, c bez tima
const playedWithTeams = async ({ hours = -2 } = {}) => {
  const owner = await createUser();
  const [a1, a2, b1, c] = await Promise.all([1, 2, 3, 4].map(() => createUser()));
  const match = await createMatch(owner, { startsInHours: hours });
  await addPlayers(match, [a1, a2, b1, c]);

  const setTeam = (u, team) =>
    pool.query("UPDATE match_players SET team = $3 WHERE match_id = $1 AND user_id = $2", [match.id, u.id, team]);

  await setTeam(a1, "A");
  await setTeam(a2, "A");
  await setTeam(b1, "B");

  return { owner, a1, a2, b1, c, match };
};

describe("ishod", () => {
  test.each([
    ["A", 7, 5, "W"],
    ["B", 7, 5, "L"],
    ["B", 2, 4, "W"],
    ["A", 3, 3, "D"],
  ])("tim %s, %i:%i -> %s", (team, a, b, expected) => {
    expect(outcome(team, a, b)).toBe(expected);
  });
});

describe("upis rezultata", () => {
  test("kreator upisuje rezultat posle termina", async () => {
    const { owner, match } = await playedWithTeams();

    const res = await setResult(match, owner, 7, 5);
    const got = await api.get(`/api/matches/${match.id}`);

    expect(res.body.success).toBe(true);
    expect(got.body.match.score_a).toBe(7);
    expect(got.body.match.score_b).toBe(5);
  });

  test("igrači dobijaju svoj ishod", async () => {
    const { owner, a1, b1, c, match } = await playedWithTeams();

    await setResult(match, owner, 7, 5);

    expect((await notificationsOf(a1))[0].message).toMatch(/^🏆 Pobeda! Tim A 7 : 5 Tim B/);
    expect((await notificationsOf(b1))[0].message).toMatch(/^Poraz/);
    expect((await notificationsOf(c))[0].message).toMatch(/^📋 Upisan je rezultat/);
    expect(await notificationsOf(owner)).toHaveLength(0);
  });

  test("pre početka termina ne može", async () => {
    const { owner, match } = await playedWithTeams({ hours: 5 });

    const res = await setResult(match, owner, 1, 0);

    expect(res.body.message).toBe("Rezultat se upisuje posle početka termina.");
  });

  test("posle 7 dana ne može", async () => {
    const { owner, match } = await playedWithTeams({ hours: -8 * 24 });

    expect((await setResult(match, owner, 1, 0)).status).toBe(400);
  });

  test("samo kreator", async () => {
    const { a1, match } = await playedWithTeams();

    expect((await setResult(match, a1, 9, 0)).status).toBe(403);
  });

  test.each([[-1, 2], [1.5, 2], ["5", 2], [5, null]])("neispravan rezultat %p : %p", async (a, b) => {
    const { owner, match } = await playedWithTeams();

    expect((await setResult(match, owner, a, b)).status).toBe(400);
  });

  test("rezultat može da se obriše", async () => {
    const { owner, match } = await playedWithTeams();

    await setResult(match, owner, 7, 5);
    await setResult(match, owner, null, null);

    expect((await api.get(`/api/matches/${match.id}`)).body.match.score_a).toBeNull();
  });
});

describe("statistika igrača", () => {
  test("pobede, nerešeno, porazi, procenat, niz i forma", async () => {
    const owner = await createUser();
    const me = await createUser();

    // Tri odigrana termina, ja uvek u timu A: poraz, pa dve pobede (najnovija poslednja)
    for (const [hours, a, b] of [[-72, 1, 3], [-48, 5, 2], [-24, 4, 0]]) {
      const match = await createMatch(owner, { startsInHours: hours });
      await addPlayers(match, [me]);
      await pool.query("UPDATE match_players SET team = 'A' WHERE match_id = $1", [match.id]);
      await pool.query("UPDATE matches SET score_a = $2, score_b = $3 WHERE id = $1", [match.id, a, b]);
    }

    expect(await stats(me)).toEqual(
      expect.objectContaining({
        wins: 2,
        draws: 0,
        losses: 1,
        winRate: 67,
        streak: 2,
        form: ["W", "W", "L"],
      })
    );
  });

  test("termin bez timova ne ulazi u statistiku", async () => {
    const { owner, c, match } = await playedWithTeams();

    await setResult(match, owner, 7, 5);

    expect(await stats(c)).toEqual(expect.objectContaining({ wins: 0, losses: 0, winRate: null }));
  });
});

describe("rang lista", () => {
  test("bodovi 3 za pobedu i 1 za nerešeno, poređano po bodovima", async () => {
    const { owner, a1, b1, match } = await playedWithTeams();
    await setResult(match, owner, 7, 5);

    // Drugi termin: nerešeno za iste igrače
    const second = await createMatch(owner, { startsInHours: -1 });
    await addPlayers(second, [a1, b1]);
    await pool.query("UPDATE match_players SET team = 'A' WHERE match_id = $1 AND user_id = $2", [second.id, a1.id]);
    await pool.query("UPDATE match_players SET team = 'B' WHERE match_id = $1 AND user_id = $2", [second.id, b1.id]);
    await setResult(second, owner, 2, 2);

    const res = await api.get("/api/users/leaderboard");
    const row = (u) => res.body.players.find((p) => p.id === u.id);

    expect(row(a1)).toEqual(expect.objectContaining({ played: 2, wins: 1, draws: 1, losses: 0, points: 4 }));
    expect(row(b1)).toEqual(expect.objectContaining({ played: 2, wins: 0, draws: 1, losses: 1, points: 1 }));
    expect(res.body.players[0].points).toBe(4);
  });

  test("ruta /leaderboard ne meša se sa profilom /:id", async () => {
    const res = await api.get("/api/users/leaderboard");

    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
  });
});

describe("timovi posle termina", () => {
  test("kreator može da podeli timove i posle utakmice", async () => {
    const owner = await createUser();
    const match = await createMatch(owner, { startsInHours: -2 });
    await addPlayers(match, [await createUser(), await createUser()]);

    const res = await api
      .post(`/api/matches/${match.id}/teams`)
      .set(auth(owner))
      .send({ mode: "random" });

    expect(res.body.success).toBe(true);
  });
});
