const fs = require("fs");
const path = require("path");
const pool = require("./db");

// Pravi sve tabele koje nedostaju. Greške prosleđuje pozivaocu.
const createTables = async () => {
  // Osnovne tabele (users, matches, ...) iz schema.sql
  await pool.query(
    fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8")
  );

  // Tabela za poruke u četu svakog termina
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_messages (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Lista čekanja za popunjene termine; redosled je po created_at
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_waitlist (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (match_id, user_id)
    )
  `);

  // Ocene posle odigranog termina: svaki učesnik jednom ocenjuje svakog drugog
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_ratings (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rated_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote TEXT NOT NULL CHECK (vote IN ('fair', 'unfair', 'no_show')),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (match_id, rater_id, rated_id),
      CHECK (rater_id <> rated_id)
    )
  `);

  // Koji podsetnici su već poslati za termin ('24h' ili '1h'), da idu samo jednom
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_reminders (
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('24h', '1h')),
      sent_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (match_id, kind)
    )
  `);

  // Tačna lokacija termina na mapi (nije obavezna)
  await pool.query(`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
  `);

  // Ponavljajući termini: šablon serije iz kog se pravi termin svake nedelje.
  // last_date je datum poslednjeg napravljenog termina u seriji.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_series (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sport VARCHAR(50) NOT NULL,
      location VARCHAR(255) NOT NULL,
      match_time TIME NOT NULL,
      max_players INTEGER NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      last_date DATE NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS series_id INTEGER
      REFERENCES match_series(id) ON DELETE SET NULL
  `);

  // Stalni igrači serije: automatski se prijavljuju na svaki novi termin
  await pool.query(`
    CREATE TABLE IF NOT EXISTS series_regulars (
      series_id INTEGER NOT NULL REFERENCES match_series(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (series_id, user_id)
    )
  `);

  // Podela igrača na timove ('A' ili 'B'); null dok kreator ne podeli
  await pool.query(`
    ALTER TABLE match_players
    ADD COLUMN IF NOT EXISTS team CHAR(1) CHECK (team IN ('A', 'B'))
  `);

  // Kad je lozinka poslednji put promenjena: tokeni izdati pre toga ne važe
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP
  `);

  // Linkovi za novu lozinku; čuva se samo hash tokena, ne sam token
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Notifikacija može da vodi na termin; posle brisanja termina ostaje bez linka
  await pool.query(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS match_id INTEGER
      REFERENCES matches(id) ON DELETE SET NULL
  `);
};

module.exports = createTables;
