// Jednom pre svih testova: pravi test bazu (ako ne postoji) i pokreće migracije
const { Client } = require("pg");

module.exports = async () => {
  require("./env");

  const { connectionConfig } = require("../../database/config");
  const admin = new Client(connectionConfig("postgres"));
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
