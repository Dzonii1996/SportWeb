const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  createMatch,
  makeAdmin,
  createVenue,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

// Rute bez obavezne prijave. Nova ruta mora da ima protect ili da se svesno doda ovde.
const PUBLIC_ROUTES = [
  "authRoutes POST /register",
  "authRoutes POST /login",
  "authRoutes POST /forgot-password",
  "authRoutes POST /reset-password",
  "matchRoutes GET /",
  "matchRoutes GET /:id",
  "matchPlayerRoutes GET /:id/players",
  "waitlistRoutes GET /:id/waitlist",
  "shareRoutes GET /matches/:id",
  "tournamentRoutes GET /",
  "tournamentRoutes GET /invite/:token",
  "tournamentRoutes GET /:id",
  "userRoutes GET /leaderboard",
  "userRoutes GET /:id",
  "venueRoutes GET /",
  "venueRoutes GET /:id",
  "venueRoutes GET /:id/reviews",
  "venueRoutes GET /:id/availability",
];

const routesDir = path.join(__dirname, "..", "routes");

const unprotectedRoutes = () =>
  fs.readdirSync(routesDir).flatMap((file) => {
    const name = file.replace(".js", "");
    const { stack } = require(path.join(routesDir, file));
    const guardedRouter = stack.some((layer) => !layer.route && layer.name === "protect");

    return stack
      .filter((layer) => layer.route)
      .filter((layer) => !guardedRouter && !layer.route.stack.some((s) => s.name === "protect"))
      .flatMap((layer) =>
        Object.keys(layer.route.methods).map((m) => `${name} ${m.toUpperCase()} ${layer.route.path}`)
      );
  });

describe("pristup rutama", () => {
  test("svaka ruta traži prijavu, osim onih na spisku javnih", () => {
    expect(unprotectedRoutes().sort()).toEqual([...PUBLIC_ROUTES].sort());
  });

  test("ruta sa :userId bi se pomešala sa prijavljenim korisnikom", () => {
    const paths = fs
      .readdirSync(routesDir)
      .flatMap((file) => require(path.join(routesDir, file)).stack)
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    expect(paths.filter((p) => p.includes(":userId"))).toEqual([]);
  });
});

describe("moji termini", () => {
  const privateMatch = async (owner) => {
    const match = await createMatch(owner);

    await pool.query("UPDATE matches SET is_private = true, share_token = 'k' WHERE id = $1", [match.id]);

    return match;
  };

  test("bez prijave se ne vide", async () => {
    const owner = await createUser();
    await privateMatch(owner);

    const res = await api.get(`/api/users/${owner.id}/matches`);

    expect(res.status).toBe(401);
    expect(res.body.created).toBeUndefined();
  });

  test("tuđi termini se ne vide", async () => {
    const [owner, other] = [await createUser(), await createUser()];
    await privateMatch(owner);

    const res = await api.get(`/api/users/${owner.id}/matches`).set(auth(other));

    expect(res.status).toBe(403);
  });

  test("svoje termine korisnik vidi", async () => {
    const owner = await createUser();
    await privateMatch(owner);

    const res = await api.get(`/api/users/${owner.id}/matches`).set(auth(owner));

    expect(res.status).toBe(200);
    expect(res.body.created).toHaveLength(1);
  });
});

describe("istekle prijave na javnim rutama", () => {
  const oldToken = (user) =>
    jwt.sign(
      { id: user.id, email: "test", iat: Math.floor(Date.now() / 1000) - 3600 },
      process.env.JWT_SECRET
    );

  test("token izdat pre promene lozinke ne otvara privatan termin", async () => {
    const owner = await createUser();
    const match = await createMatch(owner);
    await pool.query("UPDATE matches SET is_private = true, share_token = 'k' WHERE id = $1", [match.id]);
    await pool.query("UPDATE users SET password_changed_at = NOW() WHERE id = $1", [owner.id]);

    const res = await api
      .get(`/api/matches/${match.id}`)
      .set("Authorization", `Bearer ${oldToken(owner)}`);

    expect(res.status).toBe(404);
  });

  test("token obrisanog naloga nema prava admina", async () => {
    const admin = await createUser();
    await makeAdmin(admin);
    const venue = await createVenue({ status: "pending" });
    const token = auth(admin);
    await pool.query("DELETE FROM users WHERE id = $1", [admin.id]);

    const res = await api.get(`/api/venues/${venue.id}`).set(token);

    expect(res.status).toBe(404);
  });

  test("ispravan token i dalje radi na javnoj ruti", async () => {
    const owner = await createUser();
    const match = await createMatch(owner);
    await pool.query("UPDATE matches SET is_private = true, share_token = 'k' WHERE id = $1", [match.id]);

    const res = await api.get(`/api/matches/${match.id}`).set(auth(owner));

    expect(res.status).toBe(200);
  });
});

describe("slike terena", () => {
  test("fajl se ne prima pre provere prava", async () => {
    const user = await createUser();
    const venue = await createVenue();
    const uploads = path.join(__dirname, "..", "uploads");
    const before = fs.readdirSync(uploads).length;

    const res = await api
      .post(`/api/venues/${venue.id}/images`)
      .set(auth(user))
      .attach("images", Buffer.from("slika"), { filename: "x.png", contentType: "image/png" });

    expect(res.status).toBe(403);
    expect(fs.readdirSync(uploads)).toHaveLength(before);
  });

  test("nepostojeći teren", async () => {
    const user = await createUser();

    const res = await api
      .post("/api/venues/99999/images")
      .set(auth(user))
      .attach("images", Buffer.from("slika"), { filename: "x.png", contentType: "image/png" });

    expect(res.status).toBe(404);
  });
});
