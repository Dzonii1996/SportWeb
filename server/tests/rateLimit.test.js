process.env.TEST_RATE_LIMIT = "1";

const bcrypt = require("bcrypt");
const { api, pool, resetDb } = require("./helpers");

beforeAll(resetDb);
afterAll(() => pool.end());

const login = (password, language = "sr") =>
  api
    .post("/api/auth/login")
    .set("Accept-Language", language)
    .send({ email: "pera@test.rs", password });

describe("ograničenje pokušaja", () => {
  test("uspešna prijava se ne računa, a posle 10 pogrešnih sledi blokada", async () => {
    await pool.query(
      "INSERT INTO users(name, email, password) VALUES ('Pera', 'pera@test.rs', $1)",
      [await bcrypt.hash("Dobra123!", 4)]
    );

    for (let i = 0; i < 15; i++) {
      expect((await login("Dobra123!")).status).toBe(200);
    }

    for (let i = 0; i < 10; i++) {
      expect((await login("pogresna")).status).toBe(400);
    }

    const blocked = await login("pogresna");

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: "Previše pokušaja. Pokušaj ponovo kasnije.",
    });
    expect((await login("Dobra123!")).status).toBe(429);
    expect((await login("pogresna", "en")).body.message).toBe("Too many attempts. Try again later.");
  });

  test("zaboravljena lozinka ne šalje neograničeno mejlova", async () => {
    const forgot = () => api.post("/api/auth/forgot-password").send({ email: "nema@test.rs" });

    for (let i = 0; i < 10; i++) {
      expect((await forgot()).status).toBe(200);
    }

    expect((await forgot()).status).toBe(429);
  });

  test("registracija je ograničena i za neuspele i za uspele pokušaje", async () => {
    const register = (i) =>
      api.post("/api/auth/register").send({ name: `Igrač ${i}`, email: `novi${i}@test.rs`, password: "Dobra123!" });

    for (let i = 0; i < 10; i++) {
      expect((await register(i)).status).not.toBe(429);
    }

    expect((await register(99)).status).toBe(429);
  });
});
