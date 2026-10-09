-- Play logging (for TONO reports, band stats and later stream-based payouts)
-- and rights information per track.

-- Rights: who wrote each track, so we know what to report to TONO.
--   own   = the band's own song, no writer is a TONO (or sister society) member
--   tono  = a work registered with TONO / a sister society
--   cover = someone else's song (always reported)
--   NULL  = not filled in yet
ALTER TABLE tracks ADD COLUMN rights TEXT CHECK (rights IN ('own', 'tono', 'cover'));
ALTER TABLE tracks ADD COLUMN writers TEXT;         -- composers/lyricists, free text
ALTER TABLE tracks ADD COLUMN original_title TEXT;  -- the work's title (covers)
ALTER TABLE tracks ADD COLUMN iswc TEXT;            -- work code, e.g. T-123.456.789-0
ALTER TABLE tracks ADD COLUMN isrc TEXT;            -- recording code, e.g. NO-ABC-26-00001
ALTER TABLE tracks ADD COLUMN duration_sec INTEGER;
-- Deleted tracks are kept as a record (file removed from storage), so past
-- months' TONO reports stay complete.
ALTER TABLE tracks ADD COLUMN deleted_at INTEGER;
ALTER TABLE uploads ADD COLUMN duration_sec INTEGER;

-- One row per listening session of one track. The player reports how many
-- seconds were actually heard (not the playhead position, so skipping ahead
-- doesn't count). A play of 30 seconds or more counts as a stream.
CREATE TABLE plays (
  id          TEXT PRIMARY KEY,          -- random id made by the player
  user_id     TEXT NOT NULL REFERENCES users(id),
  track_id    TEXT NOT NULL REFERENCES tracks(id),
  band_id     TEXT NOT NULL REFERENCES bands(id),
  is_owner    INTEGER NOT NULL DEFAULT 0, -- the band listening to itself; never reported
  seconds     INTEGER NOT NULL DEFAULT 0,
  started_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX plays_band_time ON plays(band_id, started_at);
CREATE INDEX plays_track_time ON plays(track_id, started_at);

-- Every captured payment, so monthly revenue per band is exact (TONO's fee
-- is a share of revenue). Written when an agreement's paid period is extended.
CREATE TABLE payments (
  id           TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL REFERENCES agreements(id),
  kind         TEXT NOT NULL,            -- 'fan' | 'band_plan'
  band_id      TEXT NOT NULL REFERENCES bands(id),
  amount_ore   INTEGER NOT NULL,         -- including VAT
  captured_at  INTEGER NOT NULL
);
CREATE INDEX payments_band_time ON payments(band_id, captured_at);
