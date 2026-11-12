-- Up Migration
-- Glasanje za najboljeg igrača termina: svaki učesnik ima jedan glas po terminu
CREATE TABLE match_mvp_votes (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, voter_id),
  CHECK (voter_id <> player_id)
);

CREATE INDEX match_mvp_votes_player_idx ON match_mvp_votes(player_id);

-- Down Migration
DROP TABLE match_mvp_votes;
