import { getEnv, newId } from "@/lib/cf";

// The upload declaration: before a band can upload, the owner confirms that
// the band owns (or has permission for) everything it uploads. Every
// confirmation is saved with who, when and which version of the text. Change
// the version when the declaration or the band terms change, and every band
// is asked again on its next upload.
export const BAND_TERMS_VERSION = "2026-10-draft";

export async function hasConfirmedRights(bandId: string) {
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT 1 FROM rights_confirmations WHERE band_id = ?1 AND terms_version = ?2 LIMIT 1`,
  )
    .bind(bandId, BAND_TERMS_VERSION)
    .first();
  return row !== null;
}

export async function confirmRights(bandId: string, userId: string) {
  const { DB } = await getEnv();
  await DB.prepare(
    `INSERT INTO rights_confirmations (id, band_id, user_id, terms_version, confirmed_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(newId("rc"), bandId, userId, BAND_TERMS_VERSION, Date.now())
    .run();
}
