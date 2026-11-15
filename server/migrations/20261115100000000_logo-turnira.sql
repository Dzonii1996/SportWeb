-- Up Migration

-- Logo turnira (npr. škole domaćina), prikazuje se u zaglavlju i iznad kostura
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS logo_path TEXT;

-- Down Migration

ALTER TABLE tournaments DROP COLUMN IF EXISTS logo_path;
