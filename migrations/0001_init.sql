-- Listening Rooms: accounts, bands, tracks and who has paid for what.
-- Times are unix milliseconds.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  vipps_sub   TEXT NOT NULL UNIQUE,   -- stable id from Vipps Login ("dev:<name>" locally)
  name        TEXT,
  phone       TEXT,
  email       TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,       -- sha256 of the cookie value
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE bands (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  owner_id         TEXT REFERENCES users(id),
  member_price_kr  INTEGER NOT NULL DEFAULT 19,
  created_at       INTEGER NOT NULL
);

CREATE TABLE tracks (
  id            TEXT PRIMARY KEY,
  band_id       TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  r2_key        TEXT NOT NULL UNIQUE,
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
CREATE INDEX tracks_band ON tracks(band_id, position);

-- Uploads in progress. Their declared size counts against the band's quota
-- until they complete or go stale.
CREATE TABLE uploads (
  id            TEXT PRIMARY KEY,
  band_id       TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  r2_upload_id  TEXT NOT NULL,
  r2_key        TEXT NOT NULL,
  title         TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  parts_total   INTEGER NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX uploads_band ON uploads(band_id);

-- One row per Vipps Recurring agreement.
--   kind = 'fan'       → a fan pays 19 kr/mnd for one band's room
--   kind = 'band_plan' → a band pays 49 kr/mnd for storage and the room
-- Access is granted while paid_until (+ a short grace period) is in the future.
CREATE TABLE agreements (
  id          TEXT PRIMARY KEY,       -- Vipps agreementId
  kind        TEXT NOT NULL CHECK (kind IN ('fan', 'band_plan')),
  user_id     TEXT NOT NULL REFERENCES users(id),
  band_id     TEXT NOT NULL REFERENCES bands(id),
  status      TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | ACTIVE | STOPPED | EXPIRED
  amount_ore  INTEGER NOT NULL,
  paid_until  INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX agreements_access ON agreements(user_id, band_id, kind);
CREATE INDEX agreements_band ON agreements(band_id, kind);

-- Webhook events already processed (Vipps may deliver the same event twice).
CREATE TABLE vipps_events (
  id           TEXT PRIMARY KEY,      -- "<eventType>:<chargeId or agreementId>"
  agreement_id TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  occurred_at  INTEGER NOT NULL,
  received_at  INTEGER NOT NULL
);

-- Demo room so the existing links keep working. No owner and no tracks yet:
-- sign in, create your own band in /studio and upload there.
INSERT INTO bands (id, slug, name, owner_id, member_price_kr, created_at)
VALUES ('band_demo', 'fjorden-baby', 'Fjorden Baby', NULL, 19, 0);
