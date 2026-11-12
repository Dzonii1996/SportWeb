const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  createMatch,
  addPlayers,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const vote = (match, user, player) =>
  api.put(`/api/matches/${match.id}/mvp`).set(auth(user)).send({ player_id: player ? player.id : null });

const mvpOf = (match, user) => api.get(`/api/matches/${match.id}/mvp`).set(auth(user));

// Tina je organizovala termin juče; igrali su Ana, Bojan i Ceca
const setup = async ({ startsInHours = -24 } = {}) => {
  const tina = await createUser("Tina");
  const [ana, bojan, ceca] = [await createUser("Ana"), await createUser("Bojan"), await createUser("Ceca")];
  const match = await createMatch(tina, { startsInHours });

  await addPlayers(match, [ana, bojan, ceca]);

  return { tina, ana, bojan, ceca, match };
};

test("najbolji je onaj sa najviše glasova, od dva glasa naviše", async () => {
  const { tina, ana, bojan, ceca, match } = await setup();

  await vote(match, tina, ana);

  let res = await mvpOf(match, bojan);
  expect(res.body.canVote).toBe(true);
  expect(res.body.mvp).toEqual([]);

  await vote(match, bojan, ana);
  await vote(match, ana, ceca);

  res = await mvpOf(match, bojan);
  expect(res.body.myVote).toBe(ana.id);
  expect(res.body.mvp).toEqual([ana.id]);
  expect(res.body.votes).toEqual([
    { player_id: ana.id, votes: 2 },
    { player_id: ceca.id, votes: 1 },
  ]);
});

test("glas može da se promeni i povuče", async () => {
  const { tina, ana, bojan, match } = await setup();

  await vote(match, tina, ana);
  await vote(match, tina, bojan);

  expect((await mvpOf(match, tina)).body.votes).toEqual([{ player_id: bojan.id, votes: 1 }]);

  const res = await vote(match, tina, null);
  expect(res.body.myVote).toBeNull();
  expect(res.body.votes).toEqual([]);
});

test("pravila glasanja", async () => {
  const { tina, ana, match } = await setup();
  const outsider = await createUser("Dejan");

  expect((await vote(match, ana, ana)).body.message).toBe("Ne možeš da glasaš za sebe.");
  expect((await vote(match, outsider, ana)).status).toBe(403);
  expect((await vote(match, ana, outsider)).status).toBe(400);

  const upcoming = await createMatch(tina, { startsInHours: 5 });
  await addPlayers(upcoming, [ana]);
  const early = await api
    .put(`/api/matches/${upcoming.id}/mvp`)
    .set(auth(ana))
    .set({ "Accept-Language": "en" })
    .send({ player_id: tina.id });
  expect(early.status).toBe(400);
  expect(early.body.message).toBe("Voting starts once the game has begun.");

  const old = await createMatch(tina, { startsInHours: -24 * 8 });
  await addPlayers(old, [ana]);
  expect((await vote(old, ana, tina)).body.message).toBe("Glasanje traje 7 dana posle termina.");
});

test("broj priznanja na profilu i rang listi", async () => {
  const { tina, ana, bojan, ceca, match } = await setup();

  await pool.query("UPDATE matches SET score_a = 3, score_b = 1 WHERE id = $1", [match.id]);
  await pool.query("UPDATE match_players SET team = 'A' WHERE match_id = $1 AND user_id IN ($2, $3)", [match.id, ana.id, bojan.id]);
  await pool.query("UPDATE match_players SET team = 'B' WHERE match_id = $1 AND user_id = $2", [match.id, ceca.id]);

  await vote(match, tina, ana);
  await vote(match, bojan, ana);
  await vote(match, ceca, bojan);

  const profile = await api.get(`/api/users/${ana.id}`).set(auth(ana));
  expect(profile.body.stats.mvp).toBe(1);

  const board = await api.get("/api/users/leaderboard?sport=Fudbal");
  const byName = Object.fromEntries(board.body.players.map((p) => [p.name, p.mvp]));
  expect(byName).toEqual({ Ana: 1, Bojan: 0, Ceca: 0 });

  const basket = await api.get("/api/users/leaderboard?sport=Košarka");
  expect(basket.body.players).toEqual([]);
});
