const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  createMatch,
  addPlayers,
  makeAdmin,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const ROOT = path.join(__dirname, "..");
const saved = [];

// Slike koje su testovi napravili ne ostaju na disku
afterEach(() => {
  saved.splice(0).forEach((p) => fs.rmSync(path.join(ROOT, p), { force: true }));
});

const remember = (res) => {
  (res.body.photos || []).forEach((p) => saved.push(p.path, p.thumb_path));
  return res;
};

// Prava JPEG slika sa EXIF lokacijom (GPS), kao sa telefona
const photo = (width = 2400, height = 1600) =>
  sharp({ create: { width, height, channels: 3, background: "#2e7d32" } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "42/1 53/1 0/1" } })
    .toBuffer();

const upload = async (url, user, count = 1, { caption, files } = {}) => {
  const req = api.post(url).set(auth(user));

  for (let i = 0; i < count; i++) {
    req.attach("photos", files?.[i] ?? (await photo()), { filename: `slika${i}.jpg`, contentType: "image/jpeg" });
  }

  if (caption !== undefined) req.field("caption", caption);

  return remember(await req);
};

// Turnir koji je počeo: organizator Ogi, u odobrenoj ekipi kapiten Kaća i igrač Pera
const createTournament = async ({ status = "in_progress" } = {}) => {
  const ogi = await createUser("Ogi");
  const kaca = await createUser("Kaća");
  const pera = await createUser("Pera");
  const stranac = await createUser("Stranac");
  const t = await pool.query(
    `INSERT INTO tournaments(organizer_id, name, sport, format, location, start_date, max_teams, max_roster, status)
     VALUES($1, 'Letnji kup', 'Fudbal', 'knockout', 'Teren', CURRENT_DATE, 8, 8, $2) RETURNING *`,
    [ogi.id, status]
  );
  const team = await pool.query(
    `INSERT INTO tournament_teams(tournament_id, name, captain_id, status, invite_token)
     VALUES($1, 'Orlovi', $2, 'approved', 'x') RETURNING id`,
    [t.rows[0].id, kaca.id]
  );

  await pool.query(
    "INSERT INTO tournament_team_players(team_id, tournament_id, user_id) VALUES($1, $2, $3)",
    [team.rows[0].id, t.rows[0].id, pera.id]
  );

  return { tournament: t.rows[0], ogi, kaca, pera, stranac };
};

describe("fotografije turnira", () => {
  test("igrač dodaje slike: smanjene, sa sličicom i bez EXIF lokacije", async () => {
    const { tournament, pera } = await createTournament();

    const res = await upload(`/api/tournaments/${tournament.id}/photos`, pera, 2, { caption: "Finale" });

    expect(res.status).toBe(201);
    expect(res.body.photos).toHaveLength(2);

    const [first] = res.body.photos;
    const full = await sharp(path.join(ROOT, first.path)).metadata();
    const thumb = await sharp(path.join(ROOT, first.thumb_path)).metadata();

    expect([first.width, first.height]).toEqual([1600, 1067]);
    expect([full.width, full.height]).toEqual([1600, 1067]);
    expect([thumb.width, thumb.height]).toEqual([400, 400]);
    expect(full.exif).toBeUndefined();
    expect(first.caption).toBe("Finale");

    // Original sa telefona nije ostao u uploads/
    const leftovers = fs.readdirSync(path.join(ROOT, "uploads")).filter((f) => f.startsWith("slika"));
    expect(leftovers).toEqual([]);

    const list = await api.get(`/api/tournaments/${tournament.id}/photos`);

    expect(list.body.photos).toHaveLength(2);
    expect(list.body.photos[0].user_name).toBe("Pera");
    expect(list.body.can_upload).toBe(false);
  });

  test("ko sme da dodaje: organizator, kapiten i igrači, ali ne i ostali", async () => {
    const { tournament, ogi, kaca, stranac } = await createTournament();
    const url = `/api/tournaments/${tournament.id}/photos`;

    expect((await upload(url, ogi)).status).toBe(201);
    expect((await upload(url, kaca)).status).toBe(201);
    expect((await upload(url, stranac)).status).toBe(403);
    expect((await api.post(url).attach("photos", await photo(), "a.jpg")).status).toBe(401);

    const asCaptain = await api.get(url).set(auth(kaca));
    const asStranger = await api.get(url).set(auth(stranac));

    expect(asCaptain.body.can_upload).toBe(true);
    expect(asStranger.body.can_upload).toBe(false);
  });

  test("pre početka turnira nema slika", async () => {
    const { tournament, ogi } = await createTournament({ status: "registration" });

    const res = await upload(`/api/tournaments/${tournament.id}/photos`, ogi);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Fotografije mogu da se dodaju kad igra počne.");
  });

  test("fajl koji nije slika je odbijen i ništa ne ostaje", async () => {
    const { tournament, ogi } = await createTournament();
    const before = fs.readdirSync(path.join(ROOT, "uploads", "photos")).length;

    const res = await upload(`/api/tournaments/${tournament.id}/photos`, ogi, 2, {
      files: [await photo(), Buffer.from("ovo nije slika")],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Jedan od fajlova nije ispravna slika.");
    expect(fs.readdirSync(path.join(ROOT, "uploads", "photos")).length).toBe(before);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM photos")).rows[0].n).toBe(0);
  });

  test("predugačak opis i previše slika odjednom", async () => {
    const { tournament, ogi } = await createTournament();
    const url = `/api/tournaments/${tournament.id}/photos`;
    const small = await photo(20, 20);

    const caption = await upload(url, ogi, 1, { caption: "x".repeat(201) });
    const many = await upload(url, ogi, 11, { files: Array(11).fill(small) });

    expect(caption.status).toBe(400);
    expect(many.status).toBe(400);
    expect(many.body.message).toBe("Odjednom možeš poslati najviše 10 slika.");
  });

  test("brišu autor, organizator i admin; drugi igrač ne može", async () => {
    const { tournament, ogi, kaca, pera } = await createTournament();
    const url = `/api/tournaments/${tournament.id}/photos`;
    const [a, b, c] = (await upload(url, pera, 3)).body.photos;
    const admin = await createUser("Admin");
    await makeAdmin(admin);

    expect((await api.delete(`/api/photos/${a.id}`).set(auth(kaca))).status).toBe(403);
    expect((await api.delete(`/api/photos/${a.id}`).set(auth(pera))).status).toBe(200);
    expect((await api.delete(`/api/photos/${b.id}`).set(auth(ogi))).status).toBe(200);
    expect((await api.delete(`/api/photos/${c.id}`).set(auth(admin))).status).toBe(200);
    expect(fs.existsSync(path.join(ROOT, c.path))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, c.thumb_path))).toBe(false);

    const asKaca = await api.get(url).set(auth(kaca));
    expect(asKaca.body.photos).toEqual([]);
  });

  test("prijava ide adminu, organizatoru i autoru, i samo jednom", async () => {
    const { tournament, ogi, pera, stranac } = await createTournament();
    const admin = await createUser("Admin");
    await makeAdmin(admin);
    const [p] = (await upload(`/api/tournaments/${tournament.id}/photos`, pera)).body.photos;

    const first = await api.post(`/api/photos/${p.id}/report`).set(auth(stranac)).send({ reason: "me" });
    const again = await api.post(`/api/photos/${p.id}/report`).set(auth(stranac)).send({ reason: "me" });
    const bad = await api.post(`/api/photos/${p.id}/report`).set(auth(ogi)).send({ reason: "dosadno" });

    expect(first.status).toBe(200);
    expect(again.status).toBe(400);
    expect(bad.status).toBe(400);

    const notified = await pool.query("SELECT user_id, message FROM notifications ORDER BY user_id");

    expect(notified.rows.map((r) => r.user_id).sort()).toEqual([ogi.id, pera.id, admin.id].sort());
    expect(notified.rows[0].message).toBe(
      "🚩 Prijavljena je fotografija (osoba sa slike traži uklanjanje): Letnji kup."
    );

    const en = await api.get(`/api/notifications/${admin.id}`).set(auth(admin)).set("Accept-Language", "en");
    expect(en.body.notifications[0].message).toBe(
      "🚩 A photo was reported (a person in it asks for removal): Letnji kup."
    );

    // Broj prijava vidi samo admin
    const asAdmin = await api.get(`/api/tournaments/${tournament.id}/photos`).set(auth(admin));
    const asOgi = await api.get(`/api/tournaments/${tournament.id}/photos`).set(auth(ogi));

    expect(asAdmin.body.photos[0].reports).toBe(1);
    expect(asOgi.body.photos[0]).not.toHaveProperty("reports");
  });

  test("prva slika je naslovna u listi turnira", async () => {
    const { tournament, ogi } = await createTournament();
    const [first] = (await upload(`/api/tournaments/${tournament.id}/photos`, ogi, 2)).body.photos;

    const list = await api.get("/api/tournaments");

    expect(list.body.tournaments[0].cover_photo).toBe(first.thumb_path);
  });
});

describe("fotografije termina", () => {
  test("igrači dodaju slike tek posle početka termina", async () => {
    const tina = await createUser("Tina");
    const ana = await createUser("Ana");
    const future = await createMatch(tina, { startsInHours: 24 });
    const played = await createMatch(tina, { startsInHours: -2 });
    await addPlayers(played, [ana]);

    expect((await upload(`/api/matches/${future.id}/photos`, tina)).status).toBe(403);
    expect((await upload(`/api/matches/${played.id}/photos`, ana)).status).toBe(201);
  });

  test("slike privatnog termina vide samo učesnici i nisu u galeriji", async () => {
    const tina = await createUser("Tina");
    const stranac = await createUser("Stranac");
    const match = await createMatch(tina, { startsInHours: -2 });
    await pool.query("UPDATE matches SET is_private = true, share_token = 'tajna' WHERE id = $1", [match.id]);

    const [p] = (await upload(`/api/matches/${match.id}/photos`, tina)).body.photos;

    expect((await api.get(`/api/matches/${match.id}/photos`).set(auth(stranac))).status).toBe(404);
    expect((await api.get(`/api/matches/${match.id}/photos?key=tajna`)).status).toBe(200);
    expect(
      (await api.post(`/api/photos/${p.id}/report`).set(auth(stranac)).send({ reason: "me" })).status
    ).toBe(404);

    const gallery = await api.get("/api/photos");
    expect(gallery.body.photos).toEqual([]);
  });
});

describe("galerija", () => {
  test("najnovije slike sa turnira i javnih termina, po stranama", async () => {
    const { tournament, ogi } = await createTournament();
    const tina = await createUser("Tina");
    const match = await createMatch(tina, { startsInHours: -2 });

    await upload(`/api/tournaments/${tournament.id}/photos`, ogi, 2);
    await upload(`/api/matches/${match.id}/photos`, tina);

    const page1 = await api.get("/api/photos?limit=2");
    const page2 = await api.get("/api/photos?limit=2&page=2");

    expect(page1.body.total).toBe(3);
    expect(page1.body.has_more).toBe(true);
    expect(page1.body.photos[0].match_id).toBe(match.id);
    expect(page1.body.photos[1].tournament_name).toBe("Letnji kup");
    expect(page2.body.photos).toHaveLength(1);
  });
});
