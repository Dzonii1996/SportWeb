// Jednom pre svih testova: pravi test bazu (ako ne postoji) i pokreće migracije
const { Client } = require("pg");

module.exports = async () => {
  require("./env");

  const config = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  };

  const admin = new Client({ ...config, database: "postgres" });
  await admin.connect();

  const exists = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [process.env.DB_NAME]
  );

  if (exists.rows.length === 0) {
    // Ime baze ne može biti parametar, pa ga navodimo pod navodnicima
    await admin.query(`CREATE DATABASE "${process.env.DB_NAME.replace(/"/g, "")}"`);
  }

  await admin.end();

  await require("../../database/migrate")();
};
