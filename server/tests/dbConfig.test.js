const { pool } = require("./helpers");
const { connectionConfig } = require("../database/config");

afterAll(() => pool.end());

describe("konekcija na bazu", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  test("svaka konekcija radi u beogradskoj zoni, i kad je baza u UTC-u", async () => {
    const zone = await pool.query("SHOW timezone");

    expect(zone.rows[0].TimeZone).toBe("Europe/Belgrade");
  });

  test("DATABASE_URL sa hostinga, uz drugu bazu za testove", () => {
    process.env.DATABASE_URL = "postgres://ana:tajna@db.host:6543/sportweb";

    expect(connectionConfig().connectionString).toBe("postgres://ana:tajna@db.host:6543/sportweb");
    expect(connectionConfig("sportweb_test").connectionString).toBe(
      "postgres://ana:tajna@db.host:6543/sportweb_test"
    );
  });

  test("SSL samo kad je uključen", () => {
    delete process.env.DB_SSL;
    expect(connectionConfig().ssl).toBeUndefined();

    process.env.DB_SSL = "true";
    expect(connectionConfig().ssl).toEqual({ rejectUnauthorized: false });
  });
});
