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

const candidates = async (match, user) =>
  api.get(`/api/matches/${match.id}/invite-candidates`).set(auth(user));

const invite = (match, user, user_ids) =>
  api.post(`/api/matches/${match.id}/invites`).set(auth(user)).send({ user_ids });

// Tina je igrala sa Anom dva puta i sa Bojanom jednom; Ceca nikad
const setup = async () => {
  const tina = await createUser("Tina");
  const [ana, bojan, ceca] = [await createUser("Ana"), await createUser("Bojan"), await createUser("Ceca")];

  const old1 = await createMatch(tina, { startsInHours: -72 });
  await addPlayers(old1, [ana, bojan]);
  const old2 = await createMatch(tina, { startsInHours: -24 });
  await addPlayers(old2, [ana]);

  const match = await createMatch(tina);

  return { tina, ana, bojan, ceca, match };
};

describe("ko može da se pozove", () => {
  test("saigrači iz ranijih termina, najčešći prvi", async () => {
    const { tina, ana, bojan, match } = await setup();

    const res = await candidates(match, tina);

    expect(res.body.candidates.map((c) => [c.name, c.together])).toEqual([
      ["Ana", 2],
      ["Bojan", 1],
    ]);
    expect(res.body.candidates.map((c) => c.id)).toEqual([ana.id, bojan.id]);
  });

  test("računa se i kad je kreator bio igrač u tuđem terminu", async () => {
    const { tina, ceca, match } = await setup();
    const tudji = await createMatch(ceca, { startsInHours: -5 });
    await addPlayers(tudji, [tina]);

    const res = await candidates(match, tina);

    expect(res.body.candidates.map((c) => c.name)).toContain("Ceca");
  });

  test("već prijavljeni i oni na listi čekanja se ne nude", async () => {
    const { tina, ana, bojan, match } = await setup();
    await addPlayers(match, [ana]);
    await pool.query("INSERT INTO match_waitlist(match_id, user_id) VALUES($1, $2)", [match.id, bojan.id]);

    const res = await candidates(match, tina);

    expect(res.body.candidates).toEqual([]);
  });

  test("samo kreator vidi listu", async () => {
    const { ana, match } = await setup();

    expect((await candidates(match, ana)).status).toBe(403);
  });
});

describe("slanje poziva", () => {
  test("pozvani dobijaju notifikaciju sa imenom kreatora i linkom na termin", async () => {
    const { tina, ana, bojan, match } = await setup();

    const res = await invite(match, tina, [ana.id, bojan.id]);

    expect(res.body.invited).toBe(2);

    const note = (await notificationsOf(ana)).at(-1);

    expect(note.message).toMatch(/^📩 Tina te poziva na termin: .*Prijavi se!$/);
    expect(note.match_id).toBe(match.id);
  });

  test("pozvani su označeni, ponovni poziv ne šalje novu notifikaciju", async () => {
    const { tina, ana, match } = await setup();

    await invite(match, tina, [ana.id]);
    const again = await invite(match, tina, [ana.id]);

    expect(again.body.invited).toBe(0);
    expect(again.body.message).toBe("Izabrani igrači su već pozvani.");
    expect((await notificationsOf(ana)).filter((n) => n.message.startsWith("📩"))).toHaveLength(1);

    const list = (await candidates(match, tina)).body.candidates;

    expect(list.find((c) => c.id === ana.id).invited).toBe(true);
  });

  test("ne može se pozvati sebe, prijavljenog ni nepostojećeg korisnika", async () => {
    const { tina, ana, match } = await setup();
    await addPlayers(match, [ana]);

    const res = await invite(match, tina, [tina.id, ana.id, 999999]);

    expect(res.body.invited).toBe(0);
  });

  test("prazan izbor i previše poziva su odbijeni", async () => {
    const { tina, match } = await setup();

    expect((await invite(match, tina, [])).status).toBe(400);
    expect((await invite(match, tina, [...Array(31)].map((_, i) => i + 1))).status).toBe(400);
  });

  test("samo kreator šalje pozive", async () => {
    const { ana, bojan, match } = await setup();

    expect((await invite(match, ana, [bojan.id])).status).toBe(403);
  });

  test("na odigran termin se ne poziva", async () => {
    const { tina, ana } = await setup();
    const past = await createMatch(tina, { startsInHours: -1 });

    expect((await invite(past, tina, [ana.id])).status).toBe(400);
  });
});

describe("pozvani igrač", () => {
  test("vidi ko ga je pozvao", async () => {
    const { tina, ana, bojan, match } = await setup();
    await invite(match, tina, [ana.id]);

    const invited = await api.get(`/api/matches/${match.id}/my-invite`).set(auth(ana));
    const notInvited = await api.get(`/api/matches/${match.id}/my-invite`).set(auth(bojan));

    expect(invited.body).toEqual(expect.objectContaining({ invited: true, invited_by: "Tina" }));
    expect(notInvited.body.invited).toBe(false);
  });
});
