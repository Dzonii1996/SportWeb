require("dotenv").config({ quiet: true });

// Podešavanje konekcije na bazu, isto za server, migracije i testove.
//
// - DATABASE_URL (hosting) ili DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD (lokalno)
// - DB_SSL=true: šifrovana konekcija (Neon, Supabase, spoljna konekcija na Render)
// - Svaka konekcija radi u zoni APP_TIMEZONE (podrazumevano Europe/Belgrade).
//   Termini su u bazi lokalno vreme bez zone i porede se sa NOW(), a baze na
//   hostingu su u UTC-u, pa bi bez ovoga podsetnici kasnili 1-2 sata.

const TIMEZONE = process.env.APP_TIMEZONE || "Europe/Belgrade";

const ssl = () => {
  if (process.env.DB_SSL !== "true") return undefined;

  // Hostovane baze često imaju sertifikat koji Node ne prepoznaje bez CA fajla
  return { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" };
};

// database: druga baza na istom serveru (test baza, "postgres" za pravljenje baze)
const connectionConfig = (database) => {
  const common = { ssl: ssl(), options: `-c timezone=${TIMEZONE}` };

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);

    if (database) url.pathname = `/${database}`;

    return { connectionString: url.toString(), ...common };
  }

  return {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: database || process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ...common,
  };
};

module.exports = { TIMEZONE, connectionConfig };
