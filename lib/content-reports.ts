import { getEnv, newId } from "@/lib/cf";
import type { ReportDraft } from "@/lib/report-rules";

// Reports from the public form, and the list the admin page shows.

export async function recentReportCount(ipHash: string, since: number) {
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT COUNT(*) AS n FROM reports WHERE ip_hash = ?1 AND created_at > ?2`,
  )
    .bind(ipHash, since)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function createReport(input: {
  draft: ReportDraft;
  bandId: string | null;
  trackId: string | null;
  userId: string | null;
  ipHash: string | null;
}) {
  const { DB } = await getEnv();
  const id = newId("rep");
  const { draft } = input;
  await DB.prepare(
    `INSERT INTO reports (id, category, band_id, track_id, room_text, song_text, description,
                          reporter_name, reporter_email, reporter_user_id, ip_hash, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  )
    .bind(
      id,
      draft.category,
      input.bandId,
      input.trackId,
      draft.room || null,
      draft.song || null,
      draft.description,
      draft.name || null,
      draft.email || null,
      input.userId,
      input.ipHash,
      Date.now(),
    )
    .run();
  return id;
}

export type AdminReport = {
  id: string;
  category: "rights" | "other";
  status: "open" | "handled";
  description: string;
  roomText: string | null;
  songText: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  createdAt: number;
  handledNote: string | null;
  handledAt: number | null;
  band: { id: string; slug: string; name: string; disabled: boolean } | null;
  track: { id: string; title: string } | null;
};

export type AdminTrack = { id: string; title: string; disabled: boolean };

/** Open reports first (oldest first), then the latest handled ones. */
export async function listReports(limit = 100): Promise<AdminReport[]> {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT r.id, r.category, r.status, r.description, r.room_text, r.song_text,
            r.reporter_name, r.reporter_email, r.created_at, r.handled_note, r.handled_at,
            b.id AS band_id, b.slug, b.name AS band_name, b.disabled_at AS band_disabled_at,
            t.id AS track_id, t.title AS track_title
       FROM reports r
       LEFT JOIN bands b ON b.id = r.band_id
       LEFT JOIN tracks t ON t.id = r.track_id
      ORDER BY (r.status = 'open') DESC,
               CASE WHEN r.status = 'open' THEN r.created_at END ASC,
               r.created_at DESC
      LIMIT ?1`,
  )
    .bind(limit)
    .all<{
      id: string;
      category: "rights" | "other";
      status: "open" | "handled";
      description: string;
      room_text: string | null;
      song_text: string | null;
      reporter_name: string | null;
      reporter_email: string | null;
      created_at: number;
      handled_note: string | null;
      handled_at: number | null;
      band_id: string | null;
      slug: string | null;
      band_name: string | null;
      band_disabled_at: number | null;
      track_id: string | null;
      track_title: string | null;
    }>();
  return results.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    description: r.description,
    roomText: r.room_text,
    songText: r.song_text,
    reporterName: r.reporter_name,
    reporterEmail: r.reporter_email,
    createdAt: r.created_at,
    handledNote: r.handled_note,
    handledAt: r.handled_at,
    band:
      r.band_id && r.slug && r.band_name
        ? {
            id: r.band_id,
            slug: r.slug,
            name: r.band_name,
            disabled: r.band_disabled_at !== null,
          }
        : null,
    track:
      r.track_id && r.track_title
        ? { id: r.track_id, title: r.track_title }
        : null,
  }));
}

/** All songs of the given bands, including switched-off ones, by band id. */
export async function tracksOfBands(bandIds: string[]) {
  const byBand = new Map<string, AdminTrack[]>();
  if (bandIds.length === 0) return byBand;
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT id, band_id, title, disabled_at FROM tracks
      WHERE deleted_at IS NULL AND band_id IN (SELECT value FROM json_each(?1))
      ORDER BY position, created_at`,
  )
    .bind(JSON.stringify(bandIds))
    .all<{
      id: string;
      band_id: string;
      title: string;
      disabled_at: number | null;
    }>();
  for (const r of results) {
    const list = byBand.get(r.band_id) ?? [];
    list.push({ id: r.id, title: r.title, disabled: r.disabled_at !== null });
    byBand.set(r.band_id, list);
  }
  return byBand;
}
