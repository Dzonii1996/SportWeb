-- Up Migration

-- Igrači ekipe bez naloga u aplikaciji (npr. učenici na školskom turniru):
-- kapiten ili organizator upisuje ime, a broj na dresu i razred nisu obavezni.
-- Sastav ekipe = igrači sa nalogom (tournament_team_players) + ovi igrači.
CREATE TABLE IF NOT EXISTS tournament_team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  jersey_number SMALLINT CHECK (jersey_number BETWEEN 0 AND 99),
  grade VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tournament_team_members_team ON tournament_team_members(team_id);

-- Down Migration

DROP TABLE IF EXISTS tournament_team_members;
