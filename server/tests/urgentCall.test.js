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

const call = (match, user, headers = {}) =>
  api.post(`/api/matches/${match.id}/urgent-call`).set(auth(user)).set(headers);

const setCoords = (match, latitude, longitude) =>
  pool.query("UPDATE matches SET latitude = $2, longitude = $3 WHERE id = $1", [match.id, latitude, longitude]);

// Tina organizuje termin za 3 sata u Mitrovici. Ana i Bojan su nedavno igrali
// fudbal blizu, Ceca u Beogradu, a Dejan košarku blizu.
const setup = async () => {
  const tina = await createUser("Tina");
  const [ana, bojan, ceca, dejan] = [
    await createUser("Ana"),
    await createUser("Bojan"),
    await createUser("Ceca"),
    await createUser("Dejan"),
  ];

  const match = await createMatch(tina, { startsInHours: 3, maxPlayers: 4 });
  await setCoords(match, 42.89, 20.86);

  const nearby = await createMatch(ana, { startsInHours: -48, location: "Sala" });
  await setCoords(nearby, 42.9, 20.87);
  await addPlayers(nearby, [bojan]);

  const far = await createMatch(ceca, { startsInHours: -48, location: "Beograd" });
  await setCoords(far, 44.8, 20.46);

  const basket = await createMatch(dejan, { startsInHours: -48, location: "Hala" });
  await pool.query("UPDATE matches SET sport = 'Košarka' WHERE id = $1", [basket.id]);
  await setCoords(basket, 42.89, 20.86);

  return { tina, ana, bojan, ceca, dejan, match };
};

test("javlja igračima istog sporta iz okoline, jednom po terminu", async () => {
  const { tina, ana, bojan, ceca, dejan, match } = await setup();

  const res = await call(match, tina);

  expect(res.status).toBe(200);
  expect(res.body.notified).toBe(2);
  expect(res.body.message).toBe("Hitni poziv je poslat igračima iz okoline: 2.");

  const [anaNote] = await notificationsOf(ana);
  expect(anaNote.match_id).toBe(match.id);
  expect(anaNote.message).toMatch(/^🚨 Fali igrača: 4\. Fudbal, Teren, /);
  expect(await notificationsOf(bojan)).toHaveLength(1);
  expect(await notificationsOf(ceca)).toHaveLength(0);
  expect(await notificationsOf(dejan)).toHaveLength(0);

  const again = await call(match, tina);
  expect(again.status).toBe(400);
  expect(again.body.message).toBe("Hitni poziv za ovaj termin je već poslat.");
  expect(await notificationsOf(ana)).toHaveLength(1);
});

test("preskače prijavljene igrače, a bez mape gleda istu lokaciju", async () => {
  const { tina, ana, bojan } = await setup();
  const match = await createMatch(tina, { startsInHours: 2, location: "sala", maxPlayers: 4 });
  await addPlayers(match, [bojan]);

  const res = await call(match, tina);

  expect(res.body.notified).toBe(1);
  expect(await notificationsOf(ana)).toHaveLength(1);
  expect(await notificationsOf(bojan)).toHaveLength(0);
});

test("samo kreator, javni termin, uskoro i sa slobodnim mestima", async () => {
  const { tina, ana, match } = await setup();

  expect((await call(match, ana)).status).toBe(403);

  const later = await createMatch(tina, { startsInHours: 30 });
  const tooEarly = await call(later, tina, { "Accept-Language": "en" });
  expect(tooEarly.status).toBe(400);
  expect(tooEarly.body.message).toBe("An urgent call can be sent when the game is at most 12 hours away.");

  const full = await createMatch(tina, { startsInHours: 2, maxPlayers: 1 });
  await addPlayers(full, [ana]);
  expect((await call(full, tina)).body.message).toBe("Termin je popunjen, hitni poziv nije potreban.");

  const hidden = await createMatch(tina, { startsInHours: 2 });
  await pool.query("UPDATE matches SET is_private = true WHERE id = $1", [hidden.id]);
  expect((await call(hidden, tina)).status).toBe(400);

  const past = await createMatch(tina, { startsInHours: -1 });
  expect((await call(past, tina)).status).toBe(400);
});

test("bez igrača u okolini poziv se ne troši", async () => {
  const tina = await createUser("Tina");
  const match = await createMatch(tina, { startsInHours: 2, location: "Nigde" });

  const first = await call(match, tina);
  expect(first.status).toBe(200);
  expect(first.body.notified).toBe(0);

  const stored = await pool.query("SELECT urgent_call_at FROM matches WHERE id = $1", [match.id]);
  expect(stored.rows[0].urgent_call_at).toBeNull();
});

test("notifikacija se čita na jeziku primaoca", async () => {
  const { tina, ana, match } = await setup();
  await call(match, tina);

  const res = await api.get(`/api/notifications/${ana.id}`).set(auth(ana)).set({ "Accept-Language": "en" });

  expect(res.body.notifications[0].message).toMatch(/^🚨 Players needed: 4\. Football, Teren, \d+\/\d+\/\d{4} at \d{2}:\d{2}\. Jump in and join!$/);
});
