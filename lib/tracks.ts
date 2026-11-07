import { getEnv } from "@/lib/cf";

export type TrackSummary = {
  id: string;
  title: string;
  size_bytes: number;
  writers: string | null;
  disabled_at: number | null;
};

/** The band's songs. Songs an admin switched off are left out unless asked for. */
export async function listTracks(
  bandId: string,
  options: { includeDisabled?: boolean } = {},
) {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT id, title, size_bytes, writers, disabled_at FROM tracks
      WHERE band_id = ?1 AND deleted_at IS NULL${options.includeDisabled ? "" : " AND disabled_at IS NULL"}
      ORDER BY position, created_at`,
  )
    .bind(bandId)
    .all<TrackSummary>();
  return results;
}

/**
 * Saves the order of a band's songs. Ids that aren't the band's songs are
 * ignored; songs not mentioned go after the listed ones in their old order.
 * Returns the full order. New uploads get MAX(position) + 1, so they land last.
 */
export async function reorderTracks(bandId: string, trackIds: string[]) {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT id FROM tracks WHERE band_id = ?1 AND deleted_at IS NULL
      ORDER BY position, created_at`,
  )
    .bind(bandId)
    .all<{ id: string }>();
  const own = new Set(results.map((r) => r.id));
  const listed = [...new Set(trackIds)].filter((id) => own.has(id));
  const listedSet = new Set(listed);
  const ordered = [
    ...listed,
    ...results.map((r) => r.id).filter((id) => !listedSet.has(id)),
  ];
  if (ordered.length)
    await DB.batch(
      ordered.map((id, index) =>
        DB.prepare(
          "UPDATE tracks SET position = ?3 WHERE id = ?1 AND band_id = ?2",
        ).bind(id, bandId, index + 1),
      ),
    );
  return ordered;
}
