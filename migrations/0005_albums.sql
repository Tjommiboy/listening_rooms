-- Albums: a band can group its songs into albums (and the same song can be on
-- more than one album, e.g. a demo collection and a live record).
CREATE TABLE albums (
  id           TEXT PRIMARY KEY,
  band_id      TEXT NOT NULL REFERENCES bands(id),
  title        TEXT NOT NULL,
  description  TEXT,
  cover_key    TEXT,                 -- image in the band's bucket (public/)
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX albums_band ON albums(band_id, position);

CREATE TABLE album_tracks (
  album_id  TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  track_id  TEXT NOT NULL REFERENCES tracks(id),
  position  INTEGER NOT NULL,
  PRIMARY KEY (album_id, track_id)
);
CREATE INDEX album_tracks_track ON album_tracks(track_id);
