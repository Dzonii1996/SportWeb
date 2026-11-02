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
const {
  createSeriesForMatch,
  generateNextOccurrences,
} = require("../utils/series");

beforeEach(resetDb);
afterAll(() => pool.end());

// Termin u seriji koji počinje za "hours" sati (negativno: već je počeo)
const seriesMatch = async (owner, { hours = -1, maxPlayers = 10 } = {}) => {
  const match = await createMatch(owner, { startsInHours: hours, maxPlayers });
  match.series_id = await createSeriesForMatch(pool, match);

  return match;
};

// Termini serije po datumu, sa razlikom u danima od prvog
const seriesMatches = async (seriesId) =>
  (
    await pool.query(
      `SELECT id, location, match_time,
              match_date - MIN(match_date) OVER () AS days_after_first
       FROM matches WHERE series_id = $1 ORDER BY match_date`,
      [seriesId]
    )
  ).rows;

const regular = (match, user, value = true) =>
  api
    .put(`/api/matches/${match.id}/regular`)
    .set(auth(user))
    .send({ regular: value });

describe("kreiranje serije", () => {
  test("termin sa repeat_weekly pravi seriju", async () => {
    const owner = await createUser();

    const res = await api
      .post("/api/matches")
      .set(auth(owner))
      .send({
        sport: "Fudbal",
        location: "Sportski centar",
        match_date: dateIn(3),
        match_time: "20:00",
        max_players: 10,
        repeat_weekly: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.match.repeat_weekly).toBe(true);

    const got = await api.get(`/api/matches/${res.body.match.id}`);

    expect(got.body.match.repeat_weekly).toBe(true);
  });

  test("običan termin nije serija", async () => {
    const owner = await createUser();
    const match = await createMatch(owner);

    const got = await api.get(`/api/matches/${match.id}`);

    expect(got.body.match.repeat_weekly).toBe(false);
  });
});

describe("sledeći termin u seriji", () => {
  test("kad termin počne, otvara se isti termin nedelju dana kasnije", async () => {
    const owner = await createUser();
    const match = await seriesMatch(owner);

    expect(await generateNextOccurrences()).toBe(1);

    const all = await seriesMatches(match.series_id);

    expect(all).toHaveLength(2);
    expect(all[1].days_after_first).toBe(7);
    expect(all[1].match_time).toBe(all[0].match_time);

    const notes = await notificationsOf(owner);

    expect(notes[0].message).toMatch(/^🔁 Otvoren je sledeći termin u tvojoj seriji/);
    expect(notes[0].match_id).toBe(all[1].id);
  });

  test("dok termin ne počne, ništa se ne pravi", async () => {
    const owner = await createUser();
    await seriesMatch(owner, { hours: 5 });

    expect(await generateNextOccurrences()).toBe(0);
  });

  test("pravi se samo jedan sledeći termin, i pri više poziva", async () => {
    const owner = await createUser();
    const match = await seriesMatch(owner);

    await generateNextOccurrences();
    await generateNextOccurrences();

    expect(await seriesMatches(match.series_id)).toHaveLength(2);
  });

  test("ako server nije radio par nedelja, sledeći termin je u budućnosti", async () => {
    const owner = await createUser();
    const match = await seriesMatch(owner, { hours: -15 * 24 });

    await generateNextOccurrences();

    const all = await seriesMatches(match.series_id);

    expect(all).toHaveLength(2);
    expect(all[1].days_after_first).toBe(21);
  });

  test("otkazivanje jednog termina ne prekida seriju", async () => {
    const owner = await createUser();
    const match = await seriesMatch(owner);

    await api.delete(`/api/matches/${match.id}`).set(auth(owner));
    await generateNextOccurrences();

    const left = await pool.query(
      "SELECT COUNT(*) FROM matches WHERE series_id = $1",
      [match.series_id]
    );

    expect(Number(left.rows[0].count)).toBe(1);
  });

  test("zaustavljena serija ne pravi nove termine", async () => {
    const owner = await createUser();
    const match = await seriesMatch(owner);
    await pool.query("UPDATE match_series SET active = false WHERE id = $1", [match.series_id]);

    expect(await generateNextOccurrences()).toBe(0);
  });
});

describe("stalno mesto", () => {
  test("stalni igrači se sami prijavljuju; višak ide na listu čekanja", async () => {
    const owner = await createUser();
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => createUser()));
    const match = await seriesMatch(owner, { hours: 2, maxPlayers: 2 });
    await addPlayers(match, [a, b]);

    expect((await regular(match, a)).body.regular).toBe(true);
    expect((await regular(match, b)).body.regular).toBe(true);

    // c ulazi kad b napusti, pa i on uzima stalno mesto
    await api.delete(`/api/matches/${match.id}/leave`).set(auth(b));
    await addPlayers(match, [c]);
    await regular(match, c);

    // Termin počinje -> otvara se sledeći
    await pool.query(
      "UPDATE match_series SET last_date = (NOW() - INTERVAL '1 hour')::date, match_time = (NOW() - INTERVAL '1 hour')::time(0) WHERE id = $1",
      [match.series_id]
    );
    await generateNextOccurrences();

    const next = (await seriesMatches(match.series_id)).at(-1);

    // Mesta po redu uzimanja stalnog mesta: a, b, pa c na listu čekanja
    expect(await playerIds({ id: next.id })).toEqual([a.id, b.id].sort((x, y) => x - y));

    const waitlist = await api.get(`/api/matches/${next.id}/waitlist`);

    expect(waitlist.body.waitlist.map((u) => u.id)).toEqual([c.id]);
    expect((await notificationsOf(a)).at(-1).message).toMatch(/Prijavljen si automatski/);
    expect((await notificationsOf(c)).at(-1).message).toMatch(/upisan si na listu čekanja/);
  });

  test("stalno mesto traži da korisnik bude prijavljen na termin", async () => {
    const owner = await createUser();
    const match = await seriesMatch(owner, { hours: 2 });

    const res = await regular(match, await createUser());

    expect(res.body.message).toBe("Prvo se prijavi na termin.");
  });

  test("termin koji se ne ponavlja nema stalno mesto", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await createMatch(owner);
    await addPlayers(match, [player]);

    const res = await regular(match, player);

    expect(res.body.message).toBe("Ovaj termin se ne ponavlja.");
  });

  test("stalno mesto može da se isključi", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await seriesMatch(owner, { hours: 2 });
    await addPlayers(match, [player]);

    await regular(match, player, true);
    await regular(match, player, false);

    const res = await api.get(`/api/matches/${match.id}/regular`).set(auth(player));

    expect(res.body).toEqual(expect.objectContaining({ series: true, regular: false }));
  });
});

describe("izmena serije", () => {
  const editBody = (overrides) => {
    const start = new Date(Date.now() + 48 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, "0");

    return {
      location: "Teren",
      match_date: dateIn(2),
      match_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      max_players: 10,
      ...overrides,
    };
  };

  test("nova lokacija važi i za sledeće termine", async () => {
    const owner = await createUser();
    const match = await seriesMatch(owner, { hours: 48 });

    await api
      .put(`/api/matches/${match.id}`)
      .set(auth(owner))
      .send(editBody({ location: "Nova hala" }));

    const series = await pool.query("SELECT location FROM match_series WHERE id = $1", [match.series_id]);

    expect(series.rows[0].location).toBe("Nova hala");
  });

  test("isključivanje ponavljanja zaustavlja seriju", async () => {
    const owner = await createUser();
    const match = await seriesMatch(owner, { hours: 48 });

    await api
      .put(`/api/matches/${match.id}`)
      .set(auth(owner))
      .send(editBody({ repeat_weekly: false }));

    const got = await api.get(`/api/matches/${match.id}`);

    expect(got.body.match.repeat_weekly).toBe(false);
  });

  test("običan termin može da postane serija pri izmeni", async () => {
    const owner = await createUser();
    const match = await createMatch(owner);

    await api
      .put(`/api/matches/${match.id}`)
      .set(auth(owner))
      .send(editBody({ repeat_weekly: true }));

    const got = await api.get(`/api/matches/${match.id}`);

    expect(got.body.match.repeat_weekly).toBe(true);
  });
});
