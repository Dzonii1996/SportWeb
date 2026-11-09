-- Up Migration
-- Notifikacija pamti ključ poruke i parametre, da se prikaže na jeziku čitaoca.
-- Kolona message ostaje (tekst na srpskom) za starije notifikacije i kao rezerva.
ALTER TABLE notifications
  ADD COLUMN message_key TEXT,
  ADD COLUMN message_params JSONB;

-- Down Migration
ALTER TABLE notifications
  DROP COLUMN message_params,
  DROP COLUMN message_key;
