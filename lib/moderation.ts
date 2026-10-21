import { getEnv, newId } from "@/lib/cf";

// What a platform admin can do about content: switch a song or a whole band
// off (and on again) and close a report. Every action is written to
// moderation_log with the admin and the reason. Callers check isAdmin first.

type Action =
  | "disable_track"
  | "enable_track"
  | "disable_band"
  | "enable_band"
  | "resolve_report";

async function log(entry: {
  adminId: string;
  action: Action;
  targetId: string;
  bandId?: string | null;
  reportId?: string | null;
  reason?: string | null;
}) {
  const { DB } = await getEnv();
  await DB.prepare(
    `INSERT INTO moderation_log (id, admin_user_id, action, target_id, band_id, report_id, reason, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(
      newId("mod"),
      entry.adminId,
      entry.action,
      entry.targetId,
      entry.bandId ?? null,
      entry.reportId ?? null,
      entry.reason ?? null,
      Date.now(),
    )
    .run();
}

function cleanReason(reason: unknown) {
  return typeof reason === "string"
    ? reason.trim().slice(0, 300) || null
    : null;
}

/** Returns false if there is no such song. */
export async function setTrackDisabled(input: {
  adminId: string;
  trackId: string;
  disabled: boolean;
  reason?: unknown;
  reportId?: string | null;
}) {
  const { DB } = await getEnv();
  const reason = input.disabled ? cleanReason(input.reason) : null;
  const row = await DB.prepare(
    `UPDATE tracks SET disabled_at = ?2, disabled_reason = ?3
      WHERE id = ?1 AND deleted_at IS NULL
      RETURNING band_id`,
  )
    .bind(input.trackId, input.disabled ? Date.now() : null, reason)
    .first<{ band_id: string }>();
  if (!row) return false;
  await log({
    adminId: input.adminId,
    action: input.disabled ? "disable_track" : "enable_track",
    targetId: input.trackId,
    bandId: row.band_id,
    reportId: input.reportId,
    reason: cleanReason(input.reason),
  });
  return true;
}

/** Returns false if there is no such band. */
export async function setBandDisabled(input: {
  adminId: string;
  bandId: string;
  disabled: boolean;
  reason?: unknown;
  reportId?: string | null;
}) {
  const { DB } = await getEnv();
  const reason = input.disabled ? cleanReason(input.reason) : null;
  const row = await DB.prepare(
    `UPDATE bands SET disabled_at = ?2, disabled_reason = ?3 WHERE id = ?1 RETURNING id`,
  )
    .bind(input.bandId, input.disabled ? Date.now() : null, reason)
    .first<{ id: string }>();
  if (!row) return false;
  await log({
    adminId: input.adminId,
    action: input.disabled ? "disable_band" : "enable_band",
    targetId: input.bandId,
    bandId: input.bandId,
    reportId: input.reportId,
    reason: cleanReason(input.reason),
  });
  return true;
}

/** Returns false if the report doesn't exist or is already handled. */
export async function resolveReport(input: {
  adminId: string;
  reportId: string;
  note?: unknown;
}) {
  const { DB } = await getEnv();
  const note = cleanReason(input.note);
  const row = await DB.prepare(
    `UPDATE reports SET status = 'handled', handled_note = ?2, handled_by = ?3, handled_at = ?4
      WHERE id = ?1 AND status = 'open'
      RETURNING band_id`,
  )
    .bind(input.reportId, note, input.adminId, Date.now())
    .first<{ band_id: string | null }>();
  if (!row) return false;
  await log({
    adminId: input.adminId,
    action: "resolve_report",
    targetId: input.reportId,
    bandId: row.band_id,
    reportId: input.reportId,
    reason: note,
  });
  return true;
}
