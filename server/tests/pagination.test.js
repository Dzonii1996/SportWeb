const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  createMatch,
  addPlayers,
  makeAdmin,
  dateIn,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

// Termin za dan od danas; menja sport, lokaciju i koordinate
const game = async (owner, days, overrides = {}) => {
  const match = await createMatch(owner, { startsInHours: days * 24, maxPlayers: overrides.maxPlayers ?? 10 });
  await pool.query(
    `UPDATE matches SET sport = $2, location = $3, latitude = $4, longitude = $5 WHERE id = $1`,
    [
      match.id,
      overrides.sport ?? "Fudbal",
      overrides.location ?? `Teren ${days}`,
      overrides.lat ?? null,
      overrides.lng ?? null,
    ]
  );

  return match;
};

const list = async (query = "") => (await api.get(`/api/matches${query}`)).body;

describe("lista termina po stranama", () => {
  test("strane po 20, najbliži datum prvi, sa ukupnim brojem", async () => {
    const owner = await createUser();
    for (let d = 25; d >= 1; d--) await game(owner, d);

    const first = await list();
    const second = await list("?page=2");

    expect(first.matches).toHaveLength(20);
    expect(first).toMatchObject({ total: 25, page: 1, limit: 20, has_more: true });
    expect(first.matches[0].location).toBe("Teren 1");
    expect(second.matches.map((m) => m.location)).toEqual(
      ["Teren 21", "Teren 22", "Teren 23", "Teren 24", "Teren 25"]
    );
    expect(second.has_more).toBe(false);
  });

  test("strana posle poslednje je prazna, a ukupan broj ostaje tačan", async () => {
    const owner = await createUser();
    await game(owner, 1);

    expect(await list("?page=3")).toMatchObject({ matches: [], total: 1, has_more: false });
  });

  test.each([["?page=0"], ["?page=abc"], ["?limit=0"], ["?limit=51"], ["?sport=Hokej"], ["?date=2026-13-40"], ["?lat=500&lng=1"]])(
    "neispravan zahtev %s",
    async (query) => {
      expect((await api.get(`/api/matches${query}`)).status).toBe(400);
    }
  );

  test("odigrani se ne vide, osim uz past=true", async () => {
    const owner = await createUser();
    await createMatch(owner, { startsInHours: -5, location: "Odigran" });
    await game(owner, 1);

    expect((await list()).total).toBe(1);
    expect((await list("?past=true")).total).toBe(2);
  });

  test("filteri po sportu, datumu, slobodnim mestima i lokaciji", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    await game(owner, 1, { sport: "Tenis", location: "Teniski klub Đerdap" });
    const full = await game(owner, 2, { maxPlayers: 2, location: "Mala sala" });
    await addPlayers(full, [owner, player]);
    await game(owner, 3, { location: "Šumadija" });

    const names = async (q) => (await list(q)).matches.map((m) => m.location);

    expect(await names("?sport=Tenis")).toEqual(["Teniski klub Đerdap"]);
    expect(await names(`?date=${dateIn(3)}`)).toEqual(["Šumadija"]);
    expect(await names("?available=true")).toEqual(["Teniski klub Đerdap", "Šumadija"]);
    // Bez kvačica i velikih slova, đ kao dj
    expect(await names("?q=djerdap")).toEqual(["Teniski klub Đerdap"]);
    expect(await names("?q=SUMA")).toEqual(["Šumadija"]);
    expect(await names("?q=100%25")).toEqual([]);
  });

  test("blizu mene: samo u krugu, najbliži prvi, sa udaljenošću", async () => {
    const owner = await createUser();
    await game(owner, 1, { location: "Daleko", lat: 44.8, lng: 20.46 });
    await game(owner, 2, { location: "Blizu", lat: 42.9, lng: 20.87 });
    await game(owner, 3, { location: "Najbliže", lat: 42.891, lng: 20.866 });
    await game(owner, 4, { location: "Bez mape" });

    const res = await list("?lat=42.891&lng=20.866&radius=10");

    expect(res.matches.map((m) => m.location)).toEqual(["Najbliže", "Blizu"]);
    expect(res.matches[0].distance_km).toBeLessThan(0.1);
    expect(res.total).toBe(2);
  });

  test("privatni termini nisu ni u listi ni u broju", async () => {
    const owner = await createUser();
    const hidden = await game(owner, 1);
    await pool.query("UPDATE matches SET is_private = true, share_token = 'k' WHERE id = $1", [hidden.id]);
    await game(owner, 2);

    const res = await list();

    expect(res.total).toBe(1);
    expect(res.matches[0].share_token).toBeUndefined();
  });
});

describe("pregled za početnu", () => {
  test("brojevi, po sportu, prva tri i sledeći po sportu", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const first = await game(owner, 1, { location: "Teren A" });
    await addPlayers(first, [player]);
    await game(owner, 2, { location: "teren a " });
    await game(owner, 3, { sport: "Tenis", location: "Klub" });
    await game(owner, 4, { location: "Teren B" });
    await createMatch(owner, { startsInHours: -5 });

    const res = (await api.get("/api/matches/summary")).body;

    expect(res).toMatchObject({ games: 4, free_spots: 39, locations: 3 });
    expect(res.by_sport).toEqual({ Fudbal: 3, Tenis: 1 });
    expect(res.upcoming.map((m) => m.location)).toEqual(["Teren A", "teren a ", "Klub"]);
    expect(res.next_by_sport.Tenis.location).toBe("Klub");
    expect(res.next_by_sport.Fudbal.location).toBe("Teren A");
  });
});

describe("notifikacije po stranama", () => {
  test("najnovije prve, po 20, before daje starije", async () => {
    const user = await createUser();
    for (let i = 1; i <= 25; i++) {
      await pool.query("INSERT INTO notifications(user_id, message) VALUES ($1, $2)", [user.id, `Poruka ${i}`]);
    }
    const get = (q = "") => api.get(`/api/notifications/${user.id}${q}`).set(auth(user));

    const first = (await get()).body;

    expect(first.notifications).toHaveLength(20);
    expect(first.notifications[0].message).toBe("Poruka 25");
    expect(first.has_more).toBe(true);

    const older = (await get(`?before=${first.notifications[19].id}`)).body;

    expect(older.notifications.map((n) => n.message)).toEqual(
      ["Poruka 5", "Poruka 4", "Poruka 3", "Poruka 2", "Poruka 1"]
    );
    expect(older.has_more).toBe(false);
    expect((await get("?before=abc")).status).toBe(400);
  });
});

describe("turniri po stranama", () => {
  test("ukupan broj i sledeća strana", async () => {
    const admin = await createUser();
    await makeAdmin(admin);

    for (let i = 1; i <= 3; i++) {
      await api.post("/api/tournaments").set(auth(admin)).send({
        name: `Turnir ${i}`,
        sport: "Fudbal",
        format: "league",
        location: "Stadion",
        start_date: dateIn(i),
        max_teams: 4,
        max_roster: 5,
      });
    }

    const first = (await api.get("/api/tournaments?limit=2")).body;
    const second = (await api.get("/api/tournaments?limit=2&page=2")).body;

    expect(first.tournaments.map((t) => t.name)).toEqual(["Turnir 1", "Turnir 2"]);
    expect(first).toMatchObject({ total: 3, has_more: true });
    expect(second.tournaments.map((t) => t.name)).toEqual(["Turnir 3"]);
    expect(second.has_more).toBe(false);
  });
});
