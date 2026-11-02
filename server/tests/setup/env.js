// Pokreće se pre svakog test fajla, pre nego što se učita database/db.js:
// testovi uvek rade na posebnoj test bazi, nikad na pravoj.
process.env.DOTENV_CONFIG_QUIET = "true";
require("dotenv").config({ quiet: true });

// globalSetup i test fajlovi dele process.env, pa podešavamo samo jednom
if (!process.env.SPORTWEB_TEST_DB) {
  const mainDb = process.env.DB_NAME;
  const testDb = process.env.TEST_DB_NAME || `${mainDb}_test`;

  if (!testDb || testDb === mainDb) {
    throw new Error("Test baza mora imati drugačije ime od prave baze (TEST_DB_NAME).");
  }

  process.env.SPORTWEB_TEST_DB = testDb;
}

process.env.DB_NAME = process.env.SPORTWEB_TEST_DB;
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
