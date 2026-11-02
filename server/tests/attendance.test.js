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
  playerIds,
} = require("./helpers");
const { sendDueReminders } = require("../utils/reminders");

beforeEach(resetDb);
afterAll(() => pool.end());

const confirm = (match, user) =>
  api.post(`/api/matches/${match.id}/confirm`).set(auth(user));

const confirmedOf = async (match, user) =>
  (await api.get(`/api/matches/${match.id}/players`)).body.players.find(
    (p) => p.id === user.id
  )?.confirmed;

const setup = async (hours = 20) => {
  const [owner, player] = [await createUser(), await createUser("Pera")];
  const match = await createMatch(owner, { startsInHours: hours });
  await addPlayers(match, [player]);

  return { owner, player, match };
};

describe("potvrda dolaska", () => {
  test("igrač potvrđuje dolazak", async () => {
    const { player, match } = await setup();

    expect(await confirmedOf(match, player)).toBe(false);

    const res = await confirm(match, player);

    expect(res.body.success).toBe(true);
    expect(await confirmedOf(match, player)).toBe(true);
  });

  test("ponovna potvrda ne smeta", async () => {
    const { player, match } = await setup();

    await confirm(match, player);
    const again = await confirm(match, player);

    expect(again.body.success).toBe(true);
  });

  test("ko nije prijavljen ne može da potvrdi", async () => {
    const { match } = await setup();

    expect((await confirm(match, await createUser())).status).toBe(400);
  });

  test("odigran termin se ne potvrđuje", async () => {
    const { player, match } = await setup(-2);

    expect((await confirm(match, player)).status).toBe(400);
  });
});

describe("ne mogu da dođem", () => {
  test("odjava oslobađa mesto i obaveštava kreatora", async () => {
    const { owner, player, match } = await setup();

    await api.delete(`/api/matches/${match.id}/leave`).set(auth(player));

    expect(await playerIds(match)).toEqual([]);

    const notes = await notificationsOf(owner);

    expect(notes.at(-1).message).toMatch(/^🚫 Pera ne dolazi na tvoj termin/);
    expect(notes.at(-1).match_id).toBe(match.id);
  });

  test("odjava sa odigranog termina ne šalje obaveštenje", async () => {
    const { owner, player, match } = await setup(-2);

    await api.delete(`/api/matches/${match.id}/leave`).set(auth(player));

    expect(await notificationsOf(owner)).toHaveLength(0);
  });

  test("mesto dobija prvi sa liste čekanja", async () => {
    const owner = await createUser();
    const [player, waiting] = [await createUser(), await createUser()];
    const match = await createMatch(owner, { maxPlayers: 2 });
    await addPlayers(match, [player, await createUser()]);
    await api.post(`/api/matches/${match.id}/waitlist`).set(auth(waiting));

    await api.delete(`/api/matches/${match.id}/leave`).set(auth(player));

    expect(await playerIds(match)).toContain(waiting.id);
  });
});

describe("pomeranje termina", () => {
  const edit = (owner, match, overrides) => {
    const start = new Date(Date.now() + 48 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, "0");

    return api
      .put(`/api/matches/${match.id}`)
      .set(auth(owner))
      .send({
        location: "Teren",
        match_date: dateIn(2),
        match_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
        max_players: 10,
        ...overrides,
      });
  };

  test("novo vreme briše potvrde", async () => {
    const { owner, player, match } = await setup(48);
    await confirm(match, player);

    await edit(owner, match, { match_time: "23:59" });

    expect(await confirmedOf(match, player)).toBe(false);
  });

  test("promena samo broja mesta ne briše potvrde", async () => {
    const { owner, player, match } = await setup(48);
    await confirm(match, player);

    await edit(owner, match, { max_players: 12 });

    expect(await confirmedOf(match, player)).toBe(true);
  });
});

describe("podsetnik dan ranije", () => {
  test("igrač dobija molbu da potvrdi, kreator svoju poruku", async () => {
    const { owner, player, match } = await setup(20);
    await pool.query(
      "UPDATE matches SET created_at = NOW() - INTERVAL '7 days' WHERE id = $1",
      [match.id]
    );

    await sendDueReminders();

    expect((await notificationsOf(player))[0].message).toMatch(/Potvrdi da dolaziš\.$/);
    expect((await notificationsOf(owner))[0].message).toMatch(/^⏰ Sutra je tvoj termin.*potvrđuju dolazak/);
  });
});
