import { getEnv } from "@/lib/cf";

export type TrackSummary = { id: string; title: string; size_bytes: number };

export async function listTracks(bandId: string) {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    "SELECT id, title, size_bytes FROM tracks WHERE band_id = ?1 ORDER BY position, created_at",
  )
    .bind(bandId)
    .all<TrackSummary>();
  return results;
}
