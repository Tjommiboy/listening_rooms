-- Content safety: bands confirm they own what they upload, we can switch off
-- a song or a whole band, and anyone can report a room.
-- Times are unix milliseconds.

-- Every time a band confirmed the upload declaration (append-only, so we can
-- show who confirmed what, and when). A band must confirm again when
-- BAND_TERMS_VERSION in lib/rights.ts changes.
CREATE TABLE rights_confirmations (
  id             TEXT PRIMARY KEY,
  band_id        TEXT NOT NULL REFERENCES bands(id),
  user_id        TEXT NOT NULL REFERENCES users(id),
  terms_version  TEXT NOT NULL,
  confirmed_at   INTEGER NOT NULL
);
CREATE INDEX rights_confirmations_band ON rights_confirmations(band_id, terms_version);

-- Switched off by a platform admin (not by the band). A disabled song cannot
-- be streamed, listed or found by search; a disabled band is hidden from fans,
-- discovery and search, and its fans get no new charges.
ALTER TABLE bands ADD COLUMN disabled_at INTEGER;
ALTER TABLE bands ADD COLUMN disabled_reason TEXT;
ALTER TABLE tracks ADD COLUMN disabled_at INTEGER;
ALTER TABLE tracks ADD COLUMN disabled_reason TEXT;

-- Disabled songs drop out of search, like deleted ones (replaces the triggers
-- from 0009, which only looked at deleted_at).
DROP TRIGGER search_tracks_ai;
DROP TRIGGER search_tracks_au;
CREATE TRIGGER search_tracks_ai AFTER INSERT ON tracks
  WHEN new.deleted_at IS NULL AND new.disabled_at IS NULL BEGIN
  INSERT INTO search_index (title, kind, ref_id, band_id)
  VALUES (new.title, 'track', new.id, new.band_id);
END;
CREATE TRIGGER search_tracks_au AFTER UPDATE OF title, deleted_at, disabled_at ON tracks BEGIN
  DELETE FROM search_index WHERE kind = 'track' AND ref_id = old.id;
  INSERT INTO search_index (title, kind, ref_id, band_id)
  SELECT new.title, 'track', new.id, new.band_id
   WHERE new.deleted_at IS NULL AND new.disabled_at IS NULL;
END;

-- Reports from the public form (rights holders, fans, anyone).
CREATE TABLE reports (
  id                TEXT PRIMARY KEY,
  category          TEXT NOT NULL CHECK (category IN ('rights', 'other')),
  band_id           TEXT REFERENCES bands(id),
  track_id          TEXT REFERENCES tracks(id),
  room_text         TEXT,            -- what the reporter typed for the room
  song_text         TEXT,            -- what the reporter typed for the song
  description       TEXT NOT NULL,
  reporter_name     TEXT,
  reporter_email    TEXT,
  reporter_user_id  TEXT REFERENCES users(id),
  ip_hash           TEXT,            -- only used to limit spam; never shown
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled')),
  handled_note      TEXT,
  handled_by        TEXT REFERENCES users(id),
  handled_at        INTEGER,
  created_at        INTEGER NOT NULL
);
CREATE INDEX reports_status ON reports(status, created_at);
CREATE INDEX reports_ip ON reports(ip_hash, created_at);

-- What an admin did and why (disable/enable, closing a report).
CREATE TABLE moderation_log (
  id             TEXT PRIMARY KEY,
  admin_user_id  TEXT NOT NULL REFERENCES users(id),
  action         TEXT NOT NULL,      -- disable_track | enable_track | disable_band | enable_band | resolve_report
  target_id      TEXT NOT NULL,      -- track, band or report id
  band_id        TEXT,
  report_id      TEXT,
  reason         TEXT,
  created_at     INTEGER NOT NULL
);
CREATE INDEX moderation_log_band ON moderation_log(band_id, created_at);
