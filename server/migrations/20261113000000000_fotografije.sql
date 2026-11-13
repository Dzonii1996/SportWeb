-- Up Migration
-- Fotografije sa turnira i termina. Svaka pripada tačno jednom turniru ili terminu.
CREATE TABLE photos (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  thumb_path TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  caption VARCHAR(200),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT photos_one_owner CHECK ((tournament_id IS NULL) <> (match_id IS NULL))
);

CREATE INDEX photos_tournament_idx ON photos(tournament_id, id);
CREATE INDEX photos_match_idx ON photos(match_id, id);

-- Prijave: neprimeren sadržaj ili osoba sa slike traži uklanjanje
CREATE TABLE photo_reports (
  photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('inappropriate', 'me')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (photo_id, user_id)
);

-- Down Migration
DROP TABLE photo_reports;
DROP TABLE photos;
