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

beforeEach(resetDb);
afterAll(() => pool.end());

const CHAT = /^💬 Nove poruke u četu termina/;

const chatCount = async (user) =>
  (await notificationsOf(user)).filter((n) => CHAT.test(n.message)).length;

const setup = async () => {
  const owner = await createUser();
  const [a, b, outsider] = await Promise.all([1, 2, 3].map(() => createUser()));
  const match = await createMatch(owner);
  await addPlayers(match, [a, b]);

  const send = (user, message = "Ćao!") =>
    api.post(`/api/matches/${match.id}/messages`).set(auth(user)).send({ message });

  return { owner, a, b, outsider, match, send };
};

describe("čet termina", () => {
  test("učesnik šalje poruku, ostali je vide", async () => {
    const { match, a, b, send } = await setup();

    await send(a, "Ko nosi loptu?");

    const res = await api.get(`/api/matches/${match.id}/messages`).set(auth(b));

    expect(res.body.messages).toEqual([
      expect.objectContaining({ message: "Ko nosi loptu?", user_id: a.id }),
    ]);
  });

  test("neučesnik ne vidi poruke", async () => {
    const { match, a, outsider, send } = await setup();

    await send(a, "Moj broj je 064...");

    const res = await api.get(`/api/matches/${match.id}/messages`).set(auth(outsider));

    expect(res.status).toBe(403);
    expect(res.body.messages).toBeUndefined();
  });

  test("organizator i lista čekanja vide poruke, a lista čekanja ne piše", async () => {
    const { match, owner, a, outsider, send } = await setup();
    await send(a, "Ko nosi loptu?");
    await pool.query("INSERT INTO match_waitlist(match_id, user_id) VALUES ($1, $2)", [match.id, outsider.id]);

    const read = (user) => api.get(`/api/matches/${match.id}/messages`).set(auth(user));

    expect((await read(owner)).status).toBe(200);
    expect((await read(outsider)).body.messages).toHaveLength(1);
    expect((await send(outsider)).status).toBe(403);
  });

  test("neučesnik ne može da piše", async () => {
    const { outsider, send } = await setup();

    const res = await send(outsider);

    expect(res.status).toBe(403);
  });

  test("prazna poruka je odbijena", async () => {
    const { a, send } = await setup();

    const res = await send(a, "   ");

    expect(res.status).toBe(400);
  });

  test("?after vraća samo novije poruke", async () => {
    const { match, a, send } = await setup();

    const first = await send(a, "prva");
    await send(a, "druga");

    const res = await api
      .get(`/api/matches/${match.id}/messages?after=${first.body.id}`)
      .set(auth(a));

    expect(res.body.messages.map((m) => m.message)).toEqual(["druga"]);
  });
});

describe("notifikacije za čet", () => {
  test("obaveštava kreatora i druge igrače, ne pošiljaoca", async () => {
    const { owner, a, b, send } = await setup();

    await send(a);

    expect(await chatCount(owner)).toBe(1);
    expect(await chatCount(b)).toBe(1);
    expect(await chatCount(a)).toBe(0);
  });

  test("nema nove notifikacije dok prethodna nije pročitana", async () => {
    const { match, a, b, send } = await setup();

    await send(a);
    await send(a);
    expect(await chatCount(b)).toBe(1);

    // Otvaranje stranice termina označava njegove notifikacije kao pročitane
    await api.put(`/api/notifications/match/${match.id}/read`).set(auth(b));
    await send(a);

    expect(await chatCount(b)).toBe(2);
  });
});

describe("notifikacije", () => {
  test("korisnik vidi samo svoje, bez obzira na ID u adresi", async () => {
    const { owner, a, send } = await setup();
    await send(a);

    // a traži notifikacije kreatora, a dobija svoje (nema ih)
    const res = await api.get(`/api/notifications/${owner.id}`).set(auth(a));

    expect(res.body.notifications).toEqual([]);
  });
});
