-- Up Migration

-- Push obaveštenja na telefonu (PWA): jedna pretplata po browseru/uređaju.
-- language je jezik aplikacije u trenutku prijave, da obaveštenje stigne na njemu.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'sr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id);

-- Down Migration

DROP TABLE IF EXISTS push_subscriptions;
