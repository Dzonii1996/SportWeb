const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  createMatch,
  addPlayers,
  notificationsOf,
  playerIds,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

describe("prijava na termin", () => {
  test("igrač se prijavljuje, kreator dobija notifikaciju vezanu za termin", async () => {
    const [owner, player] = [await createUser(), await createUser("Pera")];
    const match = await createMatch(owner);

    const res = await api
      .post(`/api/matches/${match.id}/join`)
      .set(auth(player));

    expect(res.body.success).toBe(true);
    expect(await playerIds(match)).toEqual([player.id]);

    const notes = await notificationsOf(owner);

    expect(notes[0].message).toBe("Pera se prijavio na vaš termin (Fudbal).");
    expect(notes[0].match_id).toBe(match.id);
  });

  test("dupla prijava je odbijena", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await createMatch(owner);

    await api.post(`/api/matches/${match.id}/join`).set(auth(player));
    const again = await api.post(`/api/matches/${match.id}/join`).set(auth(player));

    expect(again.body.message).toBe("Već ste prijavljeni na ovaj termin.");
  });

  test("pun termin odbija prijavu", async () => {
    const owner = await createUser();
    const match = await createMatch(owner, { maxPlayers: 2 });
    await addPlayers(match, [await createUser(), await createUser()]);

    const res = await api
      .post(`/api/matches/${match.id}/join`)
      .set(auth(await createUser()));

    expect(res.body.message).toBe("Termin je popunjen.");
  });

  test("odigran termin odbija prijavu", async () => {
    const owner = await createUser();
    const match = await createMatch(owner, { startsInHours: -2 });

    const res = await api
      .post(`/api/matches/${match.id}/join`)
      .set(auth(await createUser()));

    expect(res.body.message).toBe("Termin je već odigran.");
  });

  test("istovremene prijave ne prepune termin", async () => {
    const owner = await createUser();
    const match = await createMatch(owner, { maxPlayers: 2 });
    const racers = await Promise.all([1, 2, 3, 4, 5].map(() => createUser()));

    const results = await Promise.all(
      racers.map((u) =>
        api.post(`/api/matches/${match.id}/join`).set(auth(u))
      )
    );

    expect(results.filter((r) => r.body.success)).toHaveLength(2);
    expect(await playerIds(match)).toHaveLength(2);
  });

  test("igrač može da napusti termin", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await createMatch(owner);
    await addPlayers(match, [player]);

    await api.delete(`/api/matches/${match.id}/leave`).set(auth(player));

    expect(await playerIds(match)).toEqual([]);
  });
});
