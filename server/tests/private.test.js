const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  createMatch,
  addPlayers,
} = require("./helpers");
const {
  createSeriesForMatch,
  generateNextOccurrences,
} = require("../utils/series");

beforeEach(resetDb);
afterAll(() => pool.end());

const body = (overrides = {}) => ({
  sport: "Fudbal",
  location: "Hala",
  match_date: dateIn(3),
  match_time: "20:00",
  max_players: 10,
  ...overrides,
});

// Privatni termin preko API-ja; vraća termin sa ključem
const privateMatch = async (owner) => {
  const res = await api.post("/api/matches").set(auth(owner)).send(body({ is_private: true }));

  return res.body.match;
};

const get = (path, user) => {
  const req = api.get(path);

  return user ? req.set(auth(user)) : req;
};

describe("kreiranje", () => {
  test("privatni termin dobija ključ za link", async () => {
    const match = await privateMatch(await createUser());

    expect(match.is_private).toBe(true);
    expect(match.share_token).toMatch(/^[a-f0-9]{32}$/);
  });

  test("javni termin nema ključ", async () => {
    const owner = await createUser();
    const res = await api.post("/api/matches").set(auth(owner)).send(body());

    expect(res.body.match.share_token).toBeNull();
  });
});

describe("ko vidi privatni termin", () => {
  test("nije na javnoj listi termina", async () => {
    const owner = await createUser();
    const priv = await privateMatch(owner);
    const pub = await createMatch(owner);

    const ids = (await api.get("/api/matches")).body.matches.map((m) => m.id);

    expect(ids).toContain(pub.id);
    expect(ids).not.toContain(priv.id);
  });

  test("bez ključa: izgleda kao da ne postoji", async () => {
    const match = await privateMatch(await createUser());
    const stranger = await createUser();

    for (const path of ["", "/players", "/waitlist"]) {
      expect((await get(`/api/matches/${match.id}${path}`)).status).toBe(404);
      expect((await get(`/api/matches/${match.id}${path}`, stranger)).status).toBe(404);
    }
  });

  test("pogrešan ključ ne pomaže", async () => {
    const match = await privateMatch(await createUser());

    expect((await get(`/api/matches/${match.id}?key=${"0".repeat(32)}`)).status).toBe(404);
  });

  test("sa ključem iz linka: vidi termin i ključ za dalje deljenje", async () => {
    const match = await privateMatch(await createUser());

    const res = await get(`/api/matches/${match.id}?key=${match.share_token}`);

    expect(res.status).toBe(200);
    expect(res.body.match.share_token).toBe(match.share_token);
  });

  test("kreator, igrači, lista čekanja i pozvani vide i bez ključa", async () => {
    const owner = await createUser();
    const [player, waiting, invited] = [await createUser(), await createUser(), await createUser()];
    const match = await privateMatch(owner);

    await addPlayers(match, [player]);
    await pool.query("INSERT INTO match_waitlist(match_id, user_id) VALUES($1, $2)", [match.id, waiting.id]);
    await pool.query("INSERT INTO match_invites(match_id, user_id) VALUES($1, $2)", [match.id, invited.id]);

    for (const user of [owner, player, waiting, invited]) {
      expect((await get(`/api/matches/${match.id}`, user)).status).toBe(200);
    }
  });

  test("javni termin ne otkriva ključ", async () => {
    const owner = await createUser();
    const match = await createMatch(owner);

    const res = await get(`/api/matches/${match.id}`);

    expect(res.body.match.share_token).toBeUndefined();
  });

  test("lista 'Moji termini' ne otkriva ključ privatnih termina", async () => {
    const owner = await createUser();
    await privateMatch(owner);

    const res = await api.get(`/api/users/${owner.id}/matches`).set(auth(owner));

    expect(res.body.created).toHaveLength(1);
    expect(res.body.created[0].share_token).toBeUndefined();
  });
});

describe("prijava i čet", () => {
  test("prijava traži ključ", async () => {
    const match = await privateMatch(await createUser());
    const player = await createUser();

    const without = await api.post(`/api/matches/${match.id}/join`).set(auth(player));
    const withKey = await api
      .post(`/api/matches/${match.id}/join?key=${match.share_token}`)
      .set(auth(player));

    expect(without.status).toBe(404);
    expect(withKey.body.success).toBe(true);
  });

  test("pozvani se prijavljuje i bez ključa", async () => {
    const owner = await createUser();
    const invited = await createUser();
    const match = await privateMatch(owner);
    await pool.query("INSERT INTO match_invites(match_id, user_id) VALUES($1, $2)", [match.id, invited.id]);

    const res = await api.post(`/api/matches/${match.id}/join`).set(auth(invited));

    expect(res.body.success).toBe(true);
  });

  test("tuđ čet privatnog termina se ne čita bez ključa", async () => {
    const match = await privateMatch(await createUser());

    const res = await api.get(`/api/matches/${match.id}/messages`).set(auth(await createUser()));

    expect(res.status).toBe(404);
  });
});

describe("link za deljenje", () => {
  test("bez ključa vraća 'Termin ne postoji'", async () => {
    const match = await privateMatch(await createUser());

    const res = await api.get(`/share/matches/${match.id}`);

    expect(res.status).toBe(404);
    expect(res.text).toContain("Termin ne postoji");
  });

  test("sa ključem vodi na termin, sa ključem u adresi", async () => {
    const match = await privateMatch(await createUser());

    const res = await api.get(`/share/matches/${match.id}?key=${match.share_token}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`/matches/${match.id}?key=${match.share_token}`);
  });
});

describe("izmena", () => {
  const edit = (owner, match, overrides) =>
    api.put(`/api/matches/${match.id}`).set(auth(owner)).send(body(overrides));

  test("kad javni termin postane privatan, dobija nov ključ", async () => {
    const owner = await createUser();
    const created = await api.post("/api/matches").set(auth(owner)).send(body());
    const match = created.body.match;

    const res = await edit(owner, match, { is_private: true });

    expect(res.body.match.is_private).toBe(true);
    expect(res.body.match.share_token).toMatch(/^[a-f0-9]{32}$/);
  });

  test("privatni ostaje sa istim ključem pri običnoj izmeni", async () => {
    const owner = await createUser();
    const match = await privateMatch(owner);

    const res = await edit(owner, match, { location: "Nova hala", is_private: true });

    expect(res.body.match.share_token).toBe(match.share_token);
  });

  test("može ponovo da postane javan", async () => {
    const owner = await createUser();
    const match = await privateMatch(owner);

    await edit(owner, match, { is_private: false });

    const ids = (await api.get("/api/matches")).body.matches.map((m) => m.id);

    expect(ids).toContain(match.id);
  });
});

describe("serije", () => {
  test("sledeći termin privatne serije je privatan, sa novim ključem", async () => {
    const owner = await createUser();
    const match = await createMatch(owner, { startsInHours: -1 });
    await pool.query("UPDATE matches SET is_private = true, share_token = 'x' WHERE id = $1", [match.id]);
    match.is_private = true;
    const seriesId = await createSeriesForMatch(pool, match);

    await generateNextOccurrences();

    const next = await pool.query(
      "SELECT is_private, share_token FROM matches WHERE series_id = $1 AND id <> $2",
      [seriesId, match.id]
    );

    expect(next.rows[0].is_private).toBe(true);
    expect(next.rows[0].share_token).toMatch(/^[a-f0-9]{32}$/);
  });
});
