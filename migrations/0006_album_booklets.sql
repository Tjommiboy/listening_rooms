-- Album booklets: pictures, liner notes and credits (composers, producers,
-- musicians, studio, artwork …). Like the music, booklets are for members.

-- {"notes": "...", "credits": [{"role": "Produsent", "name": "Kari"}]}
ALTER TABLE albums ADD COLUMN booklet TEXT;

-- Per song on an album: who played what, lyrics or notes.
ALTER TABLE album_tracks ADD COLUMN credits TEXT;  -- [{"role","name"}]
ALTER TABLE album_tracks ADD COLUMN notes TEXT;    -- lyrics / notes

CREATE TABLE album_images (
  id          TEXT PRIMARY KEY,
  album_id    TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  image_key   TEXT NOT NULL,         -- in the band's bucket (booklet/)
  caption     TEXT,
  position    INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX album_images_album ON album_images(album_id, position);
