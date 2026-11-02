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
const { sendDueReminders } = require("../utils/reminders");

beforeEach(resetDb);
afterAll(() => pool.end());

const DAY_BEFORE = /^⏰ Podsetnik: sutra igraš!/;
const HOUR_BEFORE = /^⏰ Za manje od sat vremena/;

const count = async (user, pattern) =>
  (await notificationsOf(user)).filter((n) => pattern.test(n.message)).length;

// Termin koji je napravljen pre nedelju dana i počinje za "hours" sati
const oldMatch = async (owner, hours) => {
  const match = await createMatch(owner, { startsInHours: hours });

  await pool.query(
    "UPDATE matches SET created_at = NOW() - INTERVAL '7 days' WHERE id = $1",
    [match.id]
  );

  return match;
};

describe("podsetnici pred termin", () => {
  test("dan ranije: kreator i igrači dobijaju podsetnik vezan za termin", async () => {
    const [owner, player, outsider] = [await createUser(), await createUser(), await createUser()];
    const match = await oldMatch(owner, 20);
    await addPlayers(match, [player]);

    expect(await sendDueReminders()).toBe(1);

    const notes = await notificationsOf(player);

    expect(notes).toHaveLength(1);
    expect(notes[0].message).toMatch(DAY_BEFORE);
    expect(notes[0].match_id).toBe(match.id);
    expect(await count(owner, DAY_BEFORE)).toBe(1);
    expect(await notificationsOf(outsider)).toHaveLength(0);
  });

  test("svaki podsetnik ide samo jednom", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await oldMatch(owner, 20);
    await addPlayers(match, [player]);

    await sendDueReminders();
    await sendDueReminders();

    expect(await count(player, DAY_BEFORE)).toBe(1);
  });

  test("manje od sat pre termina: samo podsetnik za sat vremena", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await oldMatch(owner, 0.5);
    await addPlayers(match, [player]);

    await sendDueReminders();

    expect(await count(player, HOUR_BEFORE)).toBe(1);
    expect(await count(player, DAY_BEFORE)).toBe(0);
  });

  test("dan ranije pa sat ranije: oba stižu, svaki u svoje vreme", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await oldMatch(owner, 20);
    await addPlayers(match, [player]);

    await sendDueReminders();

    // Prošlo je vreme: termin sada počinje za pola sata
    await pool.query(
      `UPDATE matches
       SET match_date = (NOW() + INTERVAL '30 minutes')::date,
           match_time = (NOW() + INTERVAL '30 minutes')::time(0)
       WHERE id = $1`,
      [match.id]
    );
    await sendDueReminders();

    expect(await count(player, DAY_BEFORE)).toBe(1);
    expect(await count(player, HOUR_BEFORE)).toBe(1);
  });

  test("termin napravljen pre par sati ne dobija podsetnik za dan ranije", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await createMatch(owner, { startsInHours: 5 });
    await addPlayers(match, [player]);

    await sendDueReminders();

    expect(await notificationsOf(player)).toHaveLength(0);
  });

  test("daleki i odigrani termini nemaju podsetnik", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const far = await oldMatch(owner, 72);
    const past = await oldMatch(owner, -2);
    await addPlayers(far, [player]);
    await addPlayers(past, [player]);

    expect(await sendDueReminders()).toBe(0);
    expect(await notificationsOf(player)).toHaveLength(0);
  });

  test("pomeranje termina šalje podsetnik ponovo, za novo vreme", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await oldMatch(owner, 20);
    await addPlayers(match, [player]);

    await sendDueReminders();

    // Kreator pomera termin sat kasnije (i dalje unutar 24 h)
    const start = new Date(Date.now() + 21 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, "0");

    const res = await api
      .put(`/api/matches/${match.id}`)
      .set(auth(owner))
      .send({
        location: "Teren",
        match_date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
        match_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
        max_players: 10,
      });

    expect(res.body.success).toBe(true);

    await sendDueReminders();

    expect(await count(player, DAY_BEFORE)).toBe(2);
  });
});
