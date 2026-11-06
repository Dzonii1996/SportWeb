const pool = require("./db");

// Izvršava fn u transakciji: sve se upisuje zajedno, a greška poništava sve
const withTransaction = async (fn) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await fn(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

module.exports = withTransaction;
