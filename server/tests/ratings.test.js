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

const rate = (match, rater, rated, vote) =>
  api
    .put(`/api/matches/${match.id}/ratings/${rated.id}`)
    .set(auth(rater))
    .send({ vote });

const stats = async (user) => (await api.get(`/api/users/${user.id}`)).body.stats;

// Termin odigran pre 2 sata: kreator i tri igrača
const playedMatch = async () => {
  const owner = await createUser();
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => createUser()));
  const match = await createMatch(owner, { startsInHours: -2 });
  await addPlayers(match, [a, b, c]);

  return { owner, a, b, c, match };
};

describe("ko i kada može da ocenjuje", () => {
  test("učesnik odigranog termina može", async () => {
    const { match, a } = await playedMatch();

    const res = await api.get(`/api/matches/${match.id}/ratings`).set(auth(a));

    expect(res.body.canRate).toBe(true);
  });

  test("budući termin još ne može", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await createMatch(owner);
    await addPlayers(match, [player]);

    const res = await rate(match, player, owner, "fair");

    expect(res.body.message).toBe("Ocenjivanje je moguće tek posle termina.");
  });

  test("posle 7 dana više ne može", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await createMatch(owner, { startsInHours: -8 * 24 });
    await addPlayers(match, [player]);

    const res = await rate(match, player, owner, "fair");

    expect(res.body.message).toBe("Ocenjivanje je moguće 7 dana posle termina.");
  });

  test("ne može sebe, neučesnika, niti kao neučesnik", async () => {
    const { match, a } = await playedMatch();
    const outsider = await createUser();

    expect((await rate(match, a, a, "fair")).body.message).toBe("Ne možete oceniti sebe.");
    expect((await rate(match, a, outsider, "fair")).body.message).toBe("Korisnik nije učesnik ovog termina.");
    expect((await rate(match, outsider, a, "fair")).status).toBe(403);
  });

  test("nepoznata ocena je odbijena", async () => {
    const { match, a, b } = await playedMatch();

    expect((await rate(match, a, b, "super")).status).toBe(400);
  });
});

describe("statistika na profilu", () => {
  test("fer plej je procenat fer ocena", async () => {
    const { match, owner, a, b, c } = await playedMatch();

    await rate(match, a, b, "fair");
    await rate(match, c, b, "fair");
    await rate(match, owner, b, "unfair");

    expect(await stats(b)).toEqual(
      expect.objectContaining({ played: 1, fair: 2, unfair: 1, fairPlay: 67 })
    );
  });

  test("ocena može da se promeni i poništi", async () => {
    const { match, a, b } = await playedMatch();

    await rate(match, a, b, "fair");
    await rate(match, a, b, "unfair");
    expect((await stats(b)).unfair).toBe(1);

    await rate(match, a, b, null);
    expect(await stats(b)).toEqual(expect.objectContaining({ fair: 0, unfair: 0, fairPlay: null }));
  });

  test("nedolazak: jedan igrač nije dovoljan, dva jesu", async () => {
    const { match, a, b, c } = await playedMatch();

    await rate(match, a, c, "no_show");
    expect((await stats(c)).noShows).toBe(0);

    await rate(match, b, c, "no_show");
    expect((await stats(c)).noShows).toBe(1);
  });

  test("nedolazak: kreator sam može da ga potvrdi", async () => {
    const { match, owner, a } = await playedMatch();

    await rate(match, owner, a, "no_show");

    expect((await stats(a)).noShows).toBe(1);
  });
});
