const path = require("path");
const { runner } = require("node-pg-migrate");
require("dotenv").config({ quiet: true });

// Migracije su u server/migrations. Koje su primenjene piše u tabeli pgmigrations.
// Nova izmena baze: npm run migrate:create -- naziv-izmene, pa popuni napravljeni fajl.
// Pokreću se same pri startu servera; ručno: npm run migrate i npm run migrate:down.
const migrate = (direction, { database = process.env.DB_NAME, count, log = () => {} } = {}) =>
  runner({
    databaseUrl: {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    },
    dir: path.join(__dirname, "..", "migrations"),
    migrationsTable: "pgmigrations",
    direction,
    count,
    log,
  });

// Primenjuje sve migracije koje još nisu; vraća ih kao listu. Greške prosleđuje pozivaocu.
const runMigrations = (options) => migrate("up", options);

if (require.main === module) {
  const direction = process.argv[2] === "down" ? "down" : "up";

  // Unazad se vraća samo poslednja, da greška u komandi ne obriše više izmena
  migrate(direction, { count: direction === "down" ? 1 : undefined, log: console.log }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = runMigrations;
