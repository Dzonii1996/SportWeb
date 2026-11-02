jest.mock("../utils/mailer", () => ({ sendMail: jest.fn() }));

const jwt = require("jsonwebtoken");
const { sendMail } = require("../utils/mailer");
const { api, pool, resetDb, createUser, auth } = require("./helpers");

beforeEach(async () => {
  await resetDb();
  sendMail.mockClear();
});
afterAll(() => pool.end());

const PASSWORD = "stara123";

// Korisnik sa pravom lozinkom (preko registracije)
const registered = async (email = "pera@test.rs") => {
  await api.post("/api/auth/register").send({ name: "Pera", email, password: PASSWORD });
  const login = await api.post("/api/auth/login").send({ email, password: PASSWORD });

  return { ...login.body.user, token: login.body.token };
};

// Token izdat pre minut: sigurno stariji od promene lozinke u ovom testu
const oldToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, iat: Math.floor(Date.now() / 1000) - 60 },
    process.env.JWT_SECRET
  );

const canUseApi = async (token) =>
  (await api.get("/api/notifications/1").set("Authorization", `Bearer ${token}`)).status === 200;

const login = (email, password) =>
  api.post("/api/auth/login").send({ email, password });

// Token iz linka u poslednjem mejlu
const tokenFromMail = () => {
  const text = sendMail.mock.calls.at(-1)[0].text;

  return text.match(/reset-password\?token=([a-f0-9]+)/)[1];
};

describe("registracija", () => {
  test("lozinka kraća od 6 znakova je odbijena", async () => {
    const res = await api
      .post("/api/auth/register")
      .send({ name: "Pera", email: "pera@test.rs", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Lozinka mora imati bar 6 znakova.");
  });
});

describe("izmena imena", () => {
  test("korisnik menja svoje ime", async () => {
    const me = await createUser();

    const res = await api.put(`/api/users/${me.id}`).set(auth(me)).send({ name: "  Novo Ime  " });

    expect(res.body.user.name).toBe("Novo Ime");
  });

  test("ne može tuđe ime", async () => {
    const [me, other] = [await createUser(), await createUser()];

    const res = await api.put(`/api/users/${other.id}`).set(auth(me)).send({ name: "Haker" });

    expect(res.status).toBe(403);
  });

  test("prekratko ime je odbijeno", async () => {
    const me = await createUser();

    const res = await api.put(`/api/users/${me.id}`).set(auth(me)).send({ name: "A" });

    expect(res.status).toBe(400);
  });
});

describe("promena lozinke", () => {
  const change = (user, body) =>
    api
      .put(`/api/users/${user.id}/password`)
      .set("Authorization", `Bearer ${user.token}`)
      .send(body);

  test("pogrešna trenutna lozinka", async () => {
    const me = await registered();

    const res = await change(me, { currentPassword: "pogresna", newPassword: "nova1234" });

    expect(res.body.message).toBe("Trenutna lozinka nije tačna.");
  });

  test("prekratka nova lozinka", async () => {
    const me = await registered();

    const res = await change(me, { currentPassword: PASSWORD, newPassword: "123" });

    expect(res.status).toBe(400);
  });

  test("uspešna promena: nova lozinka radi, stara ne", async () => {
    const me = await registered();

    const res = await change(me, { currentPassword: PASSWORD, newPassword: "nova1234" });

    expect(res.body.success).toBe(true);
    expect((await login(me.email, "nova1234")).body.success).toBe(true);
    expect((await login(me.email, PASSWORD)).body.success).toBe(false);
  });

  test("stare sesije se odjavljuju, novi token radi", async () => {
    const me = await registered();
    const before = oldToken(me);
    expect(await canUseApi(before)).toBe(true);

    const res = await change(me, { currentPassword: PASSWORD, newPassword: "nova1234" });

    expect(await canUseApi(before)).toBe(false);
    expect(await canUseApi(res.body.token)).toBe(true);
  });
});

describe("zaboravljena lozinka", () => {
  const forgot = (email) => api.post("/api/auth/forgot-password").send({ email });

  test("nepoznat email: isti odgovor, bez mejla", async () => {
    const res = await forgot("niko@test.rs");

    expect(res.body.message).toBe("Ako nalog sa tim emailom postoji, poslali smo link za novu lozinku.");
    expect(sendMail).not.toHaveBeenCalled();
  });

  test("postojeći email (bez obzira na velika slova): mejl sa linkom", async () => {
    await registered("pera@test.rs");

    const res = await forgot("PERA@test.rs");

    expect(res.body.message).toBe("Ako nalog sa tim emailom postoji, poslali smo link za novu lozinku.");
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe("pera@test.rs");
    expect(tokenFromMail()).toHaveLength(64);
  });

  test("u bazi se ne čuva sam token, nego hash", async () => {
    await registered();
    await forgot("pera@test.rs");

    const stored = await pool.query("SELECT token_hash FROM password_resets");

    expect(stored.rows[0].token_hash).not.toBe(tokenFromMail());
  });

  test("najviše jedan mejl u 2 minuta", async () => {
    await registered();

    await forgot("pera@test.rs");
    await forgot("pera@test.rs");

    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});

describe("nova lozinka preko linka", () => {
  const reset = (token, password = "nova1234") =>
    api.post("/api/auth/reset-password").send({ token, password });

  const requestLink = async () => {
    const me = await registered();
    await api.post("/api/auth/forgot-password").send({ email: me.email });

    return { me, token: tokenFromMail() };
  };

  test("link postavlja novu lozinku", async () => {
    const { me, token } = await requestLink();

    const res = await reset(token);

    expect(res.body.success).toBe(true);
    expect((await login(me.email, "nova1234")).body.success).toBe(true);
  });

  test("link radi samo jednom", async () => {
    const { token } = await requestLink();

    await reset(token);
    const again = await reset(token, "druga1234");

    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/istekao ili je već iskorišćen/);
  });

  test("istekao link ne radi", async () => {
    const { token } = await requestLink();
    await pool.query("UPDATE password_resets SET expires_at = NOW() - INTERVAL '1 minute'");

    expect((await reset(token)).status).toBe(400);
  });

  test("izmišljen token ne radi", async () => {
    expect((await reset("a".repeat(64))).status).toBe(400);
  });

  test("prekratka lozinka je odbijena, link ostaje važeći", async () => {
    const { token } = await requestLink();

    expect((await reset(token, "123")).status).toBe(400);
    expect((await reset(token, "nova1234")).body.success).toBe(true);
  });

  test("posle reseta stare sesije ne važe", async () => {
    const { me, token } = await requestLink();
    const before = oldToken(me);

    await reset(token);

    expect(await canUseApi(before)).toBe(false);
  });
});
