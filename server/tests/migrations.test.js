const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const runMigrations = require("../database/migrate");

// Pravljenje baze ume da potraje duže od podrazumevanih 5 sekundi
jest.setTimeout(30000);

const TEMP_DB = `${process.env.DB_NAME}_migracije`;
const baseline = fs.readFileSync(
  path.join(__dirname, "..", "migrations", "20261106000000000_pocetna-sema.sql"),
  "utf8"
);

const config = (database) => ({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database,
});

const inDatabase = async (database, fn) => {
  const client = new Client(config(database));
  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

const recreate = () =>
  inDatabase("postgres", async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${TEMP_DB}"`);
    await client.query(`CREATE DATABASE "${TEMP_DB}"`);
  });

beforeEach(recreate);
afterAll(() =>
  inDatabase("postgres", (client) => client.query(`DROP DATABASE IF EXISTS "${TEMP_DB}"`))
);

const tableNames = (client) =>
  client
    .query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    .then((r) => r.rows.map((row) => row.table_name));

describe("migracije", () => {
  test("prazna baza dobija sve tabele", async () => {
    const applied = await runMigrations({ database: TEMP_DB });

    expect(applied.length).toBeGreaterThan(0);

    const tables = await inDatabase(TEMP_DB, tableNames);

    expect(tables).toEqual(
      expect.arrayContaining(["users", "matches", "venues", "venue_reservations", "tournaments", "pgmigrations"])
    );
  });

  test("ponovno pokretanje ne radi ništa", async () => {
    await runMigrations({ database: TEMP_DB });

    expect(await runMigrations({ database: TEMP_DB })).toEqual([]);
  });

  test("postojeća baza bez evidencije migracija zadržava podatke", async () => {
    // Baza kakvu je pravio createtable.js: ista šema, ali bez tabele pgmigrations
    const up = baseline.split("-- Down Migration")[0];

    await inDatabase(TEMP_DB, async (client) => {
      await client.query(up);
      await client.query(
        "INSERT INTO users(name, email, password) VALUES ('Ana', 'ana@test.rs', 'x')"
      );
    });

    await runMigrations({ database: TEMP_DB });

    const users = await inDatabase(TEMP_DB, (client) => client.query("SELECT name FROM users"));

    expect(users.rows).toEqual([{ name: "Ana" }]);
  });

  test("početna šema ne može da se vrati unazad", async () => {
    await runMigrations({ database: TEMP_DB });

    await expect(
      inDatabase(TEMP_DB, (client) => client.query(baseline.split("-- Down Migration")[1]))
    ).rejects.toThrow(/obrisalo sve podatke/);
  });
});
