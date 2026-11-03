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

  // Troškovi terena: ukupna cena u dinarima (nije obavezna) i ko je platio
  await pool.query(`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS field_price INTEGER CHECK (field_price >= 0)
  `);

  await pool.query(`
    ALTER TABLE match_series
    ADD COLUMN IF NOT EXISTS field_price INTEGER CHECK (field_price >= 0)
  `);

  await pool.query(`
    ALTER TABLE match_players
    ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false
  `);

  // Potvrda dolaska: kada je igrač potvrdio da dolazi (null = nije još)
  await pool.query(`
    ALTER TABLE match_players
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP
  `);

  // Rezultat odigranog termina (Tim A : Tim B); null dok kreator ne upiše
  await pool.query(`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS score_a INTEGER CHECK (score_a BETWEEN 0 AND 999),
    ADD COLUMN IF NOT EXISTS score_b INTEGER CHECK (score_b BETWEEN 0 AND 999)
  `);

  // Pozivnice: kreator poziva igrače sa kojima je već igrao
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_invites (
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (match_id, user_id)
    )
  `);

  // Privatni termini: nisu na listi, a vidi ih samo ko ima link sa ključem
  // (share_token) ili je već učesnik, na listi čekanja ili pozvan
  await pool.query(`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS share_token TEXT
  `);

  await pool.query(`
    ALTER TABLE match_series
    ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false
  `);

  // Notifikacija može da vodi na termin; posle brisanja termina ostaje bez linka
  await pool.query(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS match_id INTEGER
      REFERENCES matches(id) ON DELETE SET NULL
  `);

  // Admin: dodaje i menja terene i odobrava predloge korisnika.
  // Admin je i svako čiji je email u ADMIN_EMAILS (vidi utils/admin.js).
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false
  `);

  // Katalog terena i sala. Predlog korisnika čeka odobrenje admina ('pending'),
  // a na listi i mapi su samo odobreni ('approved').
  await pool.query(`
    CREATE TABLE IF NOT EXISTS venues (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      address VARCHAR(200) NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      sports TEXT[] NOT NULL,
      surface VARCHAR(50),
      indoor BOOLEAN NOT NULL DEFAULT false,
      price_per_hour INTEGER CHECK (price_per_hour >= 0),
      working_hours VARCHAR(200),
      phone VARCHAR(30),
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('approved', 'pending', 'rejected')),
      rejection_reason TEXT,
      suggested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Slike terena; path je oblika /uploads/<fajl>
  await pool.query(`
    CREATE TABLE IF NOT EXISTS venue_images (
      id SERIAL PRIMARY KEY,
      venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Termin na terenu iz kataloga; null kad je lokacija uneta ručno
  await pool.query(`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS venue_id INTEGER
      REFERENCES venues(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE match_series
    ADD COLUMN IF NOT EXISTS venue_id INTEGER
      REFERENCES venues(id) ON DELETE SET NULL
  `);

  // Ocene terena: svaki korisnik jednom ocenjuje teren (1-5) uz komentar po želji;
  // ponovna ocena menja postojeću
  await pool.query(`
    CREATE TABLE IF NOT EXISTS venue_reviews (
      id SERIAL PRIMARY KEY,
      venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (venue_id, user_id)
    )
  `);

  // Vlasnik terena (jedan po terenu): menja podatke terena i potvrđuje rezervacije.
  // Rezervacije su po celim satima, od reservation_open_hour do reservation_close_hour.
  await pool.query(`
    ALTER TABLE venues
    ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accepts_reservations BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS reservation_open_hour SMALLINT NOT NULL DEFAULT 8
      CHECK (reservation_open_hour BETWEEN 0 AND 23),
    ADD COLUMN IF NOT EXISTS reservation_close_hour SMALLINT NOT NULL DEFAULT 23
      CHECK (reservation_close_hour BETWEEN 1 AND 24)
  `);

  // Zahtev korisnika da postane vlasnik terena; odobrava ga admin
  await pool.query(`
    CREATE TABLE IF NOT EXISTS venue_claims (
      id SERIAL PRIMARY KEY,
      venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TIMESTAMP DEFAULT NOW(),
      decided_at TIMESTAMP
    )
  `);

  // Rezervacije terena: od start_hour do end_hour (24 = ponoć) tog dana.
  // Zahtev ('pending') i potvrđena ('confirmed') zauzimaju vreme;
  // odbijena i otkazana ga oslobađaju.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS venue_reservations (
      id SERIAL PRIMARY KEY,
      venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reservation_date DATE NOT NULL,
      start_hour SMALLINT NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
      end_hour SMALLINT NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
      note TEXT,
      owner_note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CHECK (end_hour > start_hour)
    )
  `);

  // Termin napravljen uz rezervaciju terena; jedna rezervacija pripada najviše jednom terminu
  await pool.query(`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS reservation_id INTEGER
      REFERENCES venue_reservations(id) ON DELETE SET NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS matches_reservation_unique
    ON matches(reservation_id) WHERE reservation_id IS NOT NULL
  `);

  // Notifikacija o predlogu terena vodi na stranicu terena
  await pool.query(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS venue_id INTEGER
      REFERENCES venues(id) ON DELETE SET NULL
  `);

  // Notifikacija o rezervaciji vodi na stranicu rezervacija
  await pool.query(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS reservation_id INTEGER
      REFERENCES venue_reservations(id) ON DELETE SET NULL
  `);
};

module.exports = createTables;
