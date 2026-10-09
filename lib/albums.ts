import { getEnv } from "@/lib/cf";

export type Album = {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  trackIds: string[]; // in album order, deleted songs left out
};

export const MAX_ALBUM_TRACKS = 200;

export function albumCoverUrl(albumId: string, version: number) {
  return `/api/media/albums/${albumId}?v=${version}`;
}

export async function listAlbums(bandId: string): Promise<Album[]> {
  const { DB } = await getEnv();
  const [{ results: albums }, { results: links }] = await Promise.all([
    DB.prepare(
      `SELECT id, title, description, cover_key, updated_at FROM albums
        WHERE band_id = ?1 ORDER BY position, created_at`,
    )
      .bind(bandId)
      .all<{
        id: string;
        title: string;
        description: string | null;
        cover_key: string | null;
        updated_at: number;
      }>(),
    DB.prepare(
      `SELECT at.album_id, at.track_id FROM album_tracks at
         JOIN albums a ON a.id = at.album_id
         JOIN tracks t ON t.id = at.track_id
        WHERE a.band_id = ?1 AND t.deleted_at IS NULL
        ORDER BY at.position`,
    )
      .bind(bandId)
      .all<{ album_id: string; track_id: string }>(),
  ]);
  return albums.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description ?? "",
    coverUrl: a.cover_key ? albumCoverUrl(a.id, a.updated_at) : null,
    trackIds: links.filter((l) => l.album_id === a.id).map((l) => l.track_id),
  }));
}

/** Replaces an album's song list. Only the band's own, non-deleted songs. */
export async function setAlbumTracks(
  albumId: string,
  bandId: string,
  trackIds: string[],
) {
  const { DB } = await getEnv();
  const unique = [...new Set(trackIds)].slice(0, MAX_ALBUM_TRACKS);
  const valid = new Set<string>();
  if (unique.length) {
    const { results } = await DB.prepare(
      `SELECT id FROM tracks
        WHERE band_id = ?1 AND deleted_at IS NULL
          AND id IN (SELECT value FROM json_each(?2))`,
    )
      .bind(bandId, JSON.stringify(unique))
      .all<{ id: string }>();
    results.forEach((r) => valid.add(r.id));
  }
  const ordered = unique.filter((id) => valid.has(id));
  // Update in place (not delete + insert), so each song keeps its booklet
  // credits and lyrics when the album is reordered.
  await DB.batch([
    DB.prepare(
      `DELETE FROM album_tracks
        WHERE album_id = ?1 AND track_id NOT IN (SELECT value FROM json_each(?2))`,
    ).bind(albumId, JSON.stringify(ordered)),
    ...ordered.map((trackId, position) =>
      DB.prepare(
        `INSERT INTO album_tracks (album_id, track_id, position) VALUES (?1, ?2, ?3)
         ON CONFLICT (album_id, track_id) DO UPDATE SET position = excluded.position`,
      ).bind(albumId, trackId, position),
    ),
    DB.prepare("UPDATE albums SET updated_at = ?2 WHERE id = ?1").bind(
      albumId,
      Date.now(),
    ),
  ]);
  return ordered;
}

export async function getOwnAlbum(albumId: string, bandId: string) {
  const { DB } = await getEnv();
  return DB.prepare(
    "SELECT id, cover_key FROM albums WHERE id = ?1 AND band_id = ?2",
  )
    .bind(albumId, bandId)
    .first<{ id: string; cover_key: string | null }>();
}

// --- Booklets -------------------------------------------------------------

export type Credit = { role: string; name: string };
export type BookletImage = { id: string; url: string; caption: string };
export type Booklet = {
  notes: string;
  credits: Credit[];
  images: BookletImage[];
  /** Per song on the album: credits and lyrics/notes. */
  tracks: Record<string, { credits: Credit[]; notes: string }>;
};

export const BOOKLET_LIMITS = {
  notes: 20_000,
  trackNotes: 10_000,
  credits: 150,
  trackCredits: 60,
  role: 60,
  name: 200,
  images: 24,
};

/** Keeps only well-formed credits, trimmed and capped. */
export function parseCredits(input: unknown, max: number): Credit[] {
  let raw = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: Credit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { role, name } = item as Record<string, unknown>;
    const r =
      typeof role === "string" ? role.trim().slice(0, BOOKLET_LIMITS.role) : "";
    const n =
      typeof name === "string" ? name.trim().slice(0, BOOKLET_LIMITS.name) : "";
    if (!r && !n) continue;
    out.push({ role: r, name: n });
    if (out.length >= max) break;
  }
  return out;
}

export function bookletImageUrl(imageId: string) {
  return `/api/media/album-images/${imageId}`;
}

/** Booklets for all of a band's albums (only call for members/owner). */
export async function listBooklets(
  bandId: string,
): Promise<Record<string, Booklet>> {
  const { DB } = await getEnv();
  const [{ results: albums }, { results: tracks }, { results: images }] =
    await Promise.all([
      DB.prepare("SELECT id, booklet FROM albums WHERE band_id = ?1")
        .bind(bandId)
        .all<{ id: string; booklet: string | null }>(),
      DB.prepare(
        `SELECT at.album_id, at.track_id, at.credits, at.notes FROM album_tracks at
           JOIN albums a ON a.id = at.album_id WHERE a.band_id = ?1`,
      )
        .bind(bandId)
        .all<{
          album_id: string;
          track_id: string;
          credits: string | null;
          notes: string | null;
        }>(),
      DB.prepare(
        `SELECT i.id, i.album_id, i.caption FROM album_images i
           JOIN albums a ON a.id = i.album_id
          WHERE a.band_id = ?1 ORDER BY i.position, i.created_at`,
      )
        .bind(bandId)
        .all<{ id: string; album_id: string; caption: string | null }>(),
    ]);
  const result: Record<string, Booklet> = {};
  for (const a of albums) {
    let parsed: { notes?: unknown; credits?: unknown } = {};
    try {
      parsed = a.booklet ? JSON.parse(a.booklet) : {};
    } catch {}
    result[a.id] = {
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      credits: parseCredits(parsed.credits, BOOKLET_LIMITS.credits),
      images: [],
      tracks: {},
    };
  }
  for (const t of tracks) {
    const b = result[t.album_id];
    if (b)
      b.tracks[t.track_id] = {
        credits: parseCredits(t.credits, BOOKLET_LIMITS.trackCredits),
        notes: t.notes ?? "",
      };
  }
  for (const i of images) {
    result[i.album_id]?.images.push({
      id: i.id,
      url: bookletImageUrl(i.id),
      caption: i.caption ?? "",
    });
  }
  return result;
}

/** True if the booklet has anything to show. */
export function bookletHasContent(b: Booklet | undefined) {
  if (!b) return false;
  return (
    b.images.length > 0 ||
    !!b.notes ||
    b.credits.length > 0 ||
    Object.values(b.tracks).some((t) => t.credits.length > 0 || !!t.notes)
  );
}
