const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { api, pool, resetDb, createUser, auth, dateIn, makeAdmin } = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const ROOT = path.join(__dirname, "..");

// Logo sa providnom pozadinom, veći od dozvoljenog
const logoPng = () =>
  sharp({ create: { width: 900, height: 600, channels: 4, background: { r: 0, g: 80, b: 160, alpha: 0 } } })
    .png()
    .toBuffer();

const setup = async () => {
  const organizer = await createUser();
  await makeAdmin(organizer);

  const t = (
    await api.post("/api/tournaments").set(auth(organizer)).send({
      name: "Školski kup",
      sport: "Odbojka",
      format: "knockout",
      location: "Školska sala",
      start_date: dateIn(5),
      max_teams: 8,
      max_roster: 10,
    })
  ).body.tournament;

  return { organizer, t, url: `/api/tournaments/${t.id}/logo` };
};

const upload = async (url, user, file) =>
  api.post(url).set(auth(user)).attach("logo", file ?? (await logoPng()), { filename: "logo.png", contentType: "image/png" });

describe("logo turnira", () => {
  test("organizator dodaje logo: smanjen PNG sa providnom pozadinom, vidi se na turniru i listi", async () => {
    const { organizer, t, url } = await setup();

    const res = await upload(url, organizer);

    expect(res.status).toBe(200);
    expect(res.body.logo_path).toMatch(/^\/uploads\/logos\/.+\.png$/);

    const meta = await sharp(path.join(ROOT, res.body.logo_path)).metadata();

    expect(Math.max(meta.width, meta.height)).toBe(400);
    expect(meta.hasAlpha).toBe(true);

    expect((await api.get(`/api/tournaments/${t.id}`)).body.tournament.logo_path).toBe(res.body.logo_path);
    expect((await api.get("/api/tournaments")).body.tournaments[0].logo_path).toBe(res.body.logo_path);
  });

  test("novi logo menja stari, a brisanje uklanja i fajl", async () => {
    const { organizer, url } = await setup();

    const first = (await upload(url, organizer)).body.logo_path;
    const second = (await upload(url, organizer)).body.logo_path;

    expect(second).not.toBe(first);
    await new Promise((r) => setTimeout(r, 100));
    expect(fs.existsSync(path.join(ROOT, first))).toBe(false);

    expect((await api.delete(url).set(auth(organizer))).status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));
    expect(fs.existsSync(path.join(ROOT, second))).toBe(false);
  });

  test("samo organizator ili admin menja logo", async () => {
    const { url } = await setup();
    const other = await createUser();

    expect((await upload(url, other)).status).toBe(403);
    expect((await api.delete(url).set(auth(other))).status).toBe(403);
    expect((await api.post(url).attach("logo", await logoPng(), "logo.png")).status).toBe(401);
  });

  test("pokvarena slika se odbija", async () => {
    const { organizer, url } = await setup();

    const res = await upload(url, organizer, Buffer.from("nije slika"));

    expect(res.status).toBe(400);
  });
});
