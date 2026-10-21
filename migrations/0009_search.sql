-- Full-text search over band names, album titles and song titles.
-- unicode61 folds case for all letters (Æ/æ, Ø/ø, Å/å) and, with
-- remove_diacritics 2, also lets "e" match "é". Triggers keep the index in
-- step with the tables; deleted songs drop out. Which bands are *shown* (only
-- live rooms) is decided at query time, see lib/discovery.ts.
CREATE VIRTUAL TABLE search_index USING fts5(
  title,
  kind UNINDEXED,     -- 'band' | 'album' | 'track'
  ref_id UNINDEXED,   -- bands.id / albums.id / tracks.id
  band_id UNINDEXED,
  tokenize = "unicode61 remove_diacritics 2"
);

INSERT INTO search_index (title, kind, ref_id, band_id)
  SELECT name, 'band', id, id FROM bands;
INSERT INTO search_index (title, kind, ref_id, band_id)
  SELECT title, 'album', id, band_id FROM albums;
INSERT INTO search_index (title, kind, ref_id, band_id)
  SELECT title, 'track', id, band_id FROM tracks WHERE deleted_at IS NULL;

CREATE TRIGGER search_bands_ai AFTER INSERT ON bands BEGIN
  INSERT INTO search_index (title, kind, ref_id, band_id)
  VALUES (new.name, 'band', new.id, new.id);
END;
CREATE TRIGGER search_bands_au AFTER UPDATE OF name ON bands BEGIN
  UPDATE search_index SET title = new.name WHERE kind = 'band' AND ref_id = new.id;
END;
CREATE TRIGGER search_bands_ad AFTER DELETE ON bands BEGIN
  DELETE FROM search_index WHERE band_id = old.id;
END;

CREATE TRIGGER search_albums_ai AFTER INSERT ON albums BEGIN
  INSERT INTO search_index (title, kind, ref_id, band_id)
  VALUES (new.title, 'album', new.id, new.band_id);
END;
CREATE TRIGGER search_albums_au AFTER UPDATE OF title ON albums BEGIN
  UPDATE search_index SET title = new.title WHERE kind = 'album' AND ref_id = new.id;
END;
CREATE TRIGGER search_albums_ad AFTER DELETE ON albums BEGIN
  DELETE FROM search_index WHERE kind = 'album' AND ref_id = old.id;
END;

CREATE TRIGGER search_tracks_ai AFTER INSERT ON tracks WHEN new.deleted_at IS NULL BEGIN
  INSERT INTO search_index (title, kind, ref_id, band_id)
  VALUES (new.title, 'track', new.id, new.band_id);
END;
CREATE TRIGGER search_tracks_au AFTER UPDATE OF title, deleted_at ON tracks BEGIN
  DELETE FROM search_index WHERE kind = 'track' AND ref_id = old.id;
  INSERT INTO search_index (title, kind, ref_id, band_id)
  SELECT new.title, 'track', new.id, new.band_id WHERE new.deleted_at IS NULL;
END;
CREATE TRIGGER search_tracks_ad AFTER DELETE ON tracks BEGIN
  DELETE FROM search_index WHERE kind = 'track' AND ref_id = old.id;
END;

-- "Newest" and "popular now" lists.
CREATE INDEX bands_created ON bands(created_at);
CREATE INDEX plays_time ON plays(started_at);
