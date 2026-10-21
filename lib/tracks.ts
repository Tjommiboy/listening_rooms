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
