const { api, pool, resetDb, createUser, createMatch, addPlayers } = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

describe("link za deljenje", () => {
  test("vraća pregled termina i vodi na stranicu termina", async () => {
    const owner = await createUser("Tina");
    const match = await createMatch(owner, { maxPlayers: 10, location: "Sportska hala" });
    await addPlayers(match, [await createUser(), await createUser()]);

    const res = await api.get(`/share/matches/${match.id}`);

    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.text).toContain('<meta property="og:title" content="⚽ Fudbal · slobodno još 8">');
    expect(res.text).toContain("Sportska hala");
    expect(res.text).toContain("organizuje Tina");
    expect(res.text).toContain(`/matches/${match.id}"`);
  });

  test("pun termin piše popunjeno", async () => {
    const owner = await createUser();
    const match = await createMatch(owner, { maxPlayers: 2 });
    await addPlayers(match, [await createUser(), await createUser()]);

    const res = await api.get(`/share/matches/${match.id}`);

    expect(res.text).toContain("⚽ Fudbal · popunjeno");
  });

  test("HTML iz naziva lokacije se ne izvršava", async () => {
    const owner = await createUser();
    const match = await createMatch(owner, { location: '"><script>alert(1)</script>' });

    const res = await api.get(`/share/matches/${match.id}`);

    expect(res.text).not.toContain("<script>alert(1)</script>");
    expect(res.text).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("nepostojeći termin vraća 404 i vodi na listu termina", async () => {
    const res = await api.get("/share/matches/99999");

    expect(res.status).toBe(404);
    expect(res.text).toContain("Termin ne postoji");
    expect(res.text).toContain('/matches"');
  });

  test("neispravan ID ne obara server", async () => {
    const res = await api.get("/share/matches/abc");

    expect(res.status).toBe(404);
  });
});
