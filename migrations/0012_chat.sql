-- Chat in a band's room: paying fans and the band write in threads (a message
-- and its replies, one level deep). Not real-time. Times are unix milliseconds.
CREATE TABLE chat_messages (
  id          TEXT PRIMARY KEY,
  band_id     TEXT NOT NULL REFERENCES bands(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  parent_id   TEXT REFERENCES chat_messages(id),   -- NULL for a thread's first message
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  deleted_at  INTEGER,                              -- soft delete: replies stay readable
  deleted_by  TEXT REFERENCES users(id)
);
CREATE INDEX chat_messages_band ON chat_messages(band_id, parent_id, created_at);
CREATE INDEX chat_messages_parent ON chat_messages(parent_id, created_at);
CREATE INDEX chat_messages_rate ON chat_messages(band_id, user_id, created_at);

-- Fans the band has blocked from writing (they can still read and listen).
CREATE TABLE chat_blocks (
  band_id     TEXT NOT NULL REFERENCES bands(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  blocked_at  INTEGER NOT NULL,
  blocked_by  TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (band_id, user_id)
);
