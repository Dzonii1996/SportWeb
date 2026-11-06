const { api, pool } = require("./helpers");

afterAll(() => pool.end());

const originHeader = async (origin) =>
  (await api.get("/api/matches").set("Origin", origin)).headers["access-control-allow-origin"];

describe("CORS", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env.FRONTEND_URL = saved.FRONTEND_URL;
    process.env.CORS_ORIGINS = saved.CORS_ORIGINS;

    if (saved.FRONTEND_URL === undefined) delete process.env.FRONTEND_URL;
    if (saved.CORS_ORIGINS === undefined) delete process.env.CORS_ORIGINS;
  });

  test("bez FRONTEND_URL radi lokalni frontend, a tuđi sajt ne", async () => {
    delete process.env.FRONTEND_URL;
    delete process.env.CORS_ORIGINS;

    expect(await originHeader("http://localhost:3000")).toBe("http://localhost:3000");
    expect(await originHeader("https://tudji-sajt.example")).toBeUndefined();
  });

  test("sa FRONTEND_URL dozvoljena je samo ta adresa", async () => {
    process.env.FRONTEND_URL = "https://sportkm.example/";
    delete process.env.CORS_ORIGINS;

    expect(await originHeader("https://sportkm.example")).toBe("https://sportkm.example");
    expect(await originHeader("http://localhost:3000")).toBeUndefined();
    expect(await originHeader("https://sportkm.example.tudji-sajt.example")).toBeUndefined();
  });

  test("CORS_ORIGINS dodaje još adresa", async () => {
    process.env.FRONTEND_URL = "https://sportkm.example";
    process.env.CORS_ORIGINS = "https://www.sportkm.example, https://test.sportkm.example/";

    expect(await originHeader("https://www.sportkm.example")).toBe("https://www.sportkm.example");
    expect(await originHeader("https://test.sportkm.example")).toBe("https://test.sportkm.example");
  });

  test("preflight za zaštićene rute prolazi samo za dozvoljenu adresu", async () => {
    delete process.env.FRONTEND_URL;
    delete process.env.CORS_ORIGINS;

    const preflight = (origin) =>
      api
        .options("/api/matches")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "authorization,content-type");

    const allowed = await preflight("http://localhost:3000");
    const blocked = await preflight("https://tudji-sajt.example");

    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowed.headers["access-control-allow-methods"]).toMatch(/POST/);
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("zahtev bez Origin zaglavlja prolazi", async () => {
    const res = await api.get("/api/matches");

    expect(res.status).toBe(200);
  });
});
