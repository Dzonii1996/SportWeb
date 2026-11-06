-- Up Migration

-- Početna šema aplikacije. Sve ima IF NOT EXISTS, pa migracija prolazi i na
-- bazi koja je ranije napravljena preko database/createtable.js, bez diranja podataka.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  avatar TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  sport VARCHAR(50) NOT NULL,
  location VARCHAR(255) NOT NULL,
  match_date DATE NOT NULL,
  match_time TIME NOT NULL,
  max_players INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_match_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_players (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_match FOREIGN KEY (match_id)
    REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_player FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_player_match UNIQUE (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela za poruke u četu svakog termina
CREATE TABLE IF NOT EXISTS match_messages (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Lista čekanja za popunjene termine; redosled je po created_at
CREATE TABLE IF NOT EXISTS match_waitlist (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (match_id, user_id)
);

-- Ocene posle odigranog termina: svaki učesnik jednom ocenjuje svakog drugog
CREATE TABLE IF NOT EXISTS match_ratings (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rated_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('fair', 'unfair', 'no_show')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (match_id, rater_id, rated_id),
  CHECK (rater_id <> rated_id)
);

-- Koji podsetnici su već poslati za termin ('24h' ili '1h'), da idu samo jednom
CREATE TABLE IF NOT EXISTS match_reminders (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('24h', '1h')),
  sent_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (match_id, kind)
);

-- Tačna lokacija termina na mapi (nije obavezna)
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Ponavljajući termini: šablon serije iz kog se pravi termin svake nedelje.
-- last_date je datum poslednjeg napravljenog termina u seriji.
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
);

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS series_id INTEGER
  REFERENCES match_series(id) ON DELETE SET NULL;

-- Stalni igrači serije: automatski se prijavljuju na svaki novi termin
CREATE TABLE IF NOT EXISTS series_regulars (
  series_id INTEGER NOT NULL REFERENCES match_series(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (series_id, user_id)
);

-- Podela igrača na timove ('A' ili 'B'); null dok kreator ne podeli
ALTER TABLE match_players
ADD COLUMN IF NOT EXISTS team CHAR(1) CHECK (team IN ('A', 'B'));

-- Kad je lozinka poslednji put promenjena: tokeni izdati pre toga ne važe
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;

-- Linkovi za novu lozinku; čuva se samo hash tokena, ne sam token
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Troškovi terena: ukupna cena u dinarima (nije obavezna) i ko je platio
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS field_price INTEGER CHECK (field_price >= 0);

ALTER TABLE match_series
ADD COLUMN IF NOT EXISTS field_price INTEGER CHECK (field_price >= 0);

ALTER TABLE match_players
ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false;

-- Potvrda dolaska: kada je igrač potvrdio da dolazi (null = nije još)
ALTER TABLE match_players
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

-- Rezultat odigranog termina (Tim A : Tim B); null dok kreator ne upiše
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS score_a INTEGER CHECK (score_a BETWEEN 0 AND 999),
ADD COLUMN IF NOT EXISTS score_b INTEGER CHECK (score_b BETWEEN 0 AND 999);

-- Pozivnice: kreator poziva igrače sa kojima je već igrao
CREATE TABLE IF NOT EXISTS match_invites (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (match_id, user_id)
);

-- Privatni termini: nisu na listi, a vidi ih samo ko ima link sa ključem
-- (share_token) ili je već učesnik, na listi čekanja ili pozvan
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS share_token TEXT;

ALTER TABLE match_series
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Notifikacija može da vodi na termin; posle brisanja termina ostaje bez linka
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS match_id INTEGER
  REFERENCES matches(id) ON DELETE SET NULL;

-- Admin: dodaje i menja terene i odobrava predloge korisnika.
-- Admin je i svako čiji je email u ADMIN_EMAILS (vidi utils/admin.js).
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Katalog terena i sala. Predlog korisnika čeka odobrenje admina ('pending'),
-- a na listi i mapi su samo odobreni ('approved').
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
);

-- Slike terena; path je oblika /uploads/<fajl>
CREATE TABLE IF NOT EXISTS venue_images (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Termin na terenu iz kataloga; null kad je lokacija uneta ručno
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS venue_id INTEGER
  REFERENCES venues(id) ON DELETE SET NULL;

ALTER TABLE match_series
ADD COLUMN IF NOT EXISTS venue_id INTEGER
  REFERENCES venues(id) ON DELETE SET NULL;

-- Ocene terena: svaki korisnik jednom ocenjuje teren (1-5) uz komentar po želji;
-- ponovna ocena menja postojeću
CREATE TABLE IF NOT EXISTS venue_reviews (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (venue_id, user_id)
);

-- Vlasnik terena (jedan po terenu): menja podatke terena i potvrđuje rezervacije.
-- Rezervacije su po celim satima, od reservation_open_hour do reservation_close_hour.
ALTER TABLE venues
ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accepts_reservations BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reservation_open_hour SMALLINT NOT NULL DEFAULT 8
  CHECK (reservation_open_hour BETWEEN 0 AND 23),
ADD COLUMN IF NOT EXISTS reservation_close_hour SMALLINT NOT NULL DEFAULT 23
  CHECK (reservation_close_hour BETWEEN 1 AND 24);

-- Zahtev korisnika da postane vlasnik terena; odobrava ga admin
CREATE TABLE IF NOT EXISTS venue_claims (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  decided_at TIMESTAMP
);

-- Rezervacije terena: od start_hour do end_hour (24 = ponoć) tog dana.
-- Zahtev ('pending') i potvrđena ('confirmed') zauzimaju vreme;
-- odbijena i otkazana ga oslobađaju.
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
);

-- Termin napravljen uz rezervaciju terena; jedna rezervacija pripada najviše jednom terminu
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS reservation_id INTEGER
  REFERENCES venue_reservations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS matches_reservation_unique
ON matches(reservation_id) WHERE reservation_id IS NOT NULL;

-- Turniri: prave ih admin i vlasnici terena. Format je liga (svako sa svakim)
-- ili kup (nokaut). max_roster je najveći broj igrača u ekipi.
CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('league', 'knockout')),
  venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  location VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  max_teams INTEGER NOT NULL CHECK (max_teams BETWEEN 2 AND 32),
  max_roster INTEGER NOT NULL CHECK (max_roster BETWEEN 1 AND 30),
  entry_fee INTEGER CHECK (entry_fee >= 0),
  rules TEXT,
  status TEXT NOT NULL DEFAULT 'registration'
    CHECK (status IN ('registration', 'in_progress', 'finished', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ekipe na turniru; kapiten poziva igrače linkom sa invite_token
CREATE TABLE IF NOT EXISTS tournament_teams (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  captain_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  paid BOOLEAN NOT NULL DEFAULT false,
  invite_token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tournament_teams_name_unique
ON tournament_teams(tournament_id, LOWER(name)) WHERE status <> 'rejected';

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS winner_team_id INTEGER
  REFERENCES tournament_teams(id) ON DELETE SET NULL;

-- Igrač može biti u samo jednoj ekipi na turniru
CREATE TABLE IF NOT EXISTS tournament_team_players (
  team_id INTEGER NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id),
  UNIQUE (tournament_id, user_id)
);

-- Utakmice. U kupu: pobednik (round, position) ide u (round + 1, ceil(position / 2));
-- utakmica sa samo jednom ekipom je slobodan prolaz. Penali samo u kupu u fudbalu.
CREATE TABLE IF NOT EXISTS tournament_games (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  position INTEGER NOT NULL,
  team_a_id INTEGER REFERENCES tournament_teams(id) ON DELETE SET NULL,
  team_b_id INTEGER REFERENCES tournament_teams(id) ON DELETE SET NULL,
  score_a INTEGER CHECK (score_a BETWEEN 0 AND 999),
  score_b INTEGER CHECK (score_b BETWEEN 0 AND 999),
  penalties_a INTEGER CHECK (penalties_a BETWEEN 0 AND 99),
  penalties_b INTEGER CHECK (penalties_b BETWEEN 0 AND 99),
  winner_team_id INTEGER REFERENCES tournament_teams(id) ON DELETE SET NULL,
  game_date DATE,
  game_time TIME,
  reservation_id INTEGER REFERENCES venue_reservations(id) ON DELETE SET NULL,
  UNIQUE (tournament_id, round, position)
);

-- Notifikacija o turniru vodi na stranicu turnira
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS tournament_id INTEGER
  REFERENCES tournaments(id) ON DELETE SET NULL;

-- Planinarenje: podaci o stazi (naziv, težina, dužina, uspon, trajanje, oprema)
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS hike JSONB;

ALTER TABLE match_series
ADD COLUMN IF NOT EXISTS hike JSONB;

-- Notifikacija o predlogu terena vodi na stranicu terena
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS venue_id INTEGER
  REFERENCES venues(id) ON DELETE SET NULL;

-- Notifikacija o rezervaciji vodi na stranicu rezervacija
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS reservation_id INTEGER
  REFERENCES venue_reservations(id) ON DELETE SET NULL;

-- Down Migration

DO $$ BEGIN
  RAISE EXCEPTION 'Početna šema se ne vraća: to bi obrisalo sve podatke.';
END $$;
