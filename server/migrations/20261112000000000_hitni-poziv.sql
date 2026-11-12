-- Up Migration
-- Kada je kreator poslao hitni poziv "Fali igrač" (jednom po terminu)
ALTER TABLE matches
  ADD COLUMN urgent_call_at TIMESTAMP;

-- Down Migration
ALTER TABLE matches
  DROP COLUMN urgent_call_at;
