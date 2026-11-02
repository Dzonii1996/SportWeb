const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  createMatch,
  addPlayers,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

describe("registracija i prijava", () => {
  test("nov korisnik može da se registruje i prijavi", async () => {
    const reg = await api.post("/api/auth/register").send({
      name: "Marko",
      email: "marko@test.rs",
      password: "tajna123",
    });

    expect(reg.status).toBe(201);

    const login = await api.post("/api/auth/login").send({
      email: "marko@test.rs",
      password: "tajna123",
    });

    expect(login.body.success).toBe(true);
    expect(login.body.token).toBeTruthy();
    expect(login.body.user).toEqual(
      expect.objectContaining({ name: "Marko", email: "marko@test.rs" })
    );
    expect(login.body.user.password).toBeUndefined();
  });

  test("pogrešna lozinka ne prolazi", async () => {
    await api.post("/api/auth/register").send({
      name: "Marko",
      email: "marko@test.rs",
      password: "tajna123",
    });

    const login = await api.post("/api/auth/login").send({
      email: "marko@test.rs",
      password: "pogresna",
    });

    expect(login.status).toBe(400);
    expect(login.body.token).toBeUndefined();
  });

  test("isti email ne može dvaput", async () => {
    const body = { name: "Marko", email: "marko@test.rs", password: "tajna123" };

    await api.post("/api/auth/register").send(body);
    const again = await api.post("/api/auth/register").send(body);

    expect(again.status).toBe(400);
  });
});

describe("zaštićene rute", () => {
  test.each([
    ["post", "/api/matches"],
    ["post", "/api/matches/1/join"],
    ["delete", "/api/matches/1/leave"],
    ["post", "/api/matches/1/messages"],
    ["get", "/api/notifications/1"],
    ["post", "/api/matches/1/waitlist"],
  ])("%s %s bez tokena vraća 401", async (method, path) => {
    const res = await api[method](path);

    expect(res.status).toBe(401);
  });

  test("lažan token vraća 401", async () => {
    const res = await api
      .get("/api/notifications/1")
      .set("Authorization", "Bearer abc.def.ghi");

    expect(res.status).toBe(401);
  });

  test("korisnik ne može da promeni tuđi avatar", async () => {
    const [me, other] = [await createUser(), await createUser()];

    const res = await api
      .post(`/api/users/${other.id}/avatar`)
      .set(auth(me));

    expect(res.status).toBe(403);
  });

  test("upload avatara prima samo slike", async () => {
    const me = await createUser();

    const res = await api
      .post(`/api/users/${me.id}/avatar`)
      .set(auth(me))
      .attach("avatar", Buffer.from("<script>alert(1)</script>"), {
        filename: "x.html",
        contentType: "text/html",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/samo slike/);
  });
});

describe("privatnost emaila", () => {
  test("javni profil ne prikazuje email drugima", async () => {
    const [me, other] = [await createUser(), await createUser()];

    const anonymous = await api.get(`/api/users/${me.id}`);
    const asOther = await api.get(`/api/users/${me.id}`).set(auth(other));

    expect(anonymous.body.user.email).toBeUndefined();
    expect(asOther.body.user.email).toBeUndefined();
  });

  test("vlasnik vidi svoj email", async () => {
    const me = await createUser();

    const res = await api.get(`/api/users/${me.id}`).set(auth(me));

    expect(res.body.user.email).toMatch(/@test\.rs$/);
  });

  test("neispravan token na javnom profilu ne smeta, samo nema emaila", async () => {
    const me = await createUser();

    const res = await api
      .get(`/api/users/${me.id}`)
      .set("Authorization", "Bearer abc.def.ghi");

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBeUndefined();
  });

  test("lista učesnika termina ne sadrži email", async () => {
    const [owner, player] = [await createUser(), await createUser()];
    const match = await createMatch(owner);
    await addPlayers(match, [player]);

    const res = await api.get(`/api/matches/${match.id}/players`);

    expect(res.body.players).toHaveLength(1);
    expect(res.body.players[0].email).toBeUndefined();
  });
});
