const pool = require("./db");

// Tabela za poruke u četu svakog termina
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS match_messages (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (error) {
    console.log("Greška pri kreiranju tabela:", error.message);
  }
};

module.exports = createTables;
