import { addMonth } from "@/lib/access";
import { getEnv, newId } from "@/lib/cf";
import type { AgreementStatus } from "@/lib/vipps";

export type AgreementKind = "fan" | "band_plan";

export async function insertPendingAgreement(input: {
  id: string;
  kind: AgreementKind;
  userId: string;
  bandId: string;
  amountKr: number;
}) {
  const { DB } = await getEnv();
  const now = Date.now();
  await DB.prepare(
    `INSERT INTO agreements (id, kind, user_id, band_id, status, amount_ore, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, 'PENDING', ?5, ?6, ?6)`,
  )
    .bind(
      input.id,
      input.kind,
      input.userId,
      input.bandId,
      input.amountKr * 100,
      now,
    )
    .run();
}

/** Newest agreement of a kind for a user and band (for the return page). */
export async function latestAgreement(
  userId: string,
  bandId: string,
  kind: AgreementKind,
) {
  const { DB } = await getEnv();
  return DB.prepare(
    `SELECT id, status, paid_until FROM agreements
      WHERE user_id = ?1 AND band_id = ?2 AND kind = ?3
      ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId, bandId, kind)
    .first<{ id: string; status: string; paid_until: number | null }>();
}

/**
 * Records a captured payment: the agreement is paid one month from when the
 * money was taken. The paid period only ever moves forward, so calling this
 * twice for the same charge (webhook + status check) neither gives away an
 * extra month nor logs the payment twice.
 */
export async function markPaid(agreementId: string, capturedAt: number) {
  const { DB } = await getEnv();
  const now = Date.now();
  const extended = await DB.prepare(
    `UPDATE agreements
        SET status = CASE WHEN status = 'PENDING' THEN 'ACTIVE' ELSE status END,
            paid_until = ?2,
            updated_at = ?3
      WHERE id = ?1 AND COALESCE(paid_until, 0) < ?2
      RETURNING kind, band_id, amount_ore`,
  )
    .bind(agreementId, addMonth(capturedAt), now)
    .first<{ kind: string; band_id: string; amount_ore: number }>();
  if (!extended) return;
  await DB.prepare(
    `INSERT INTO payments (id, agreement_id, kind, band_id, amount_ore, captured_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(
      newId("pay"),
      agreementId,
      extended.kind,
      extended.band_id,
      extended.amount_ore,
      capturedAt,
    )
    .run();
}

/** Mirrors the Vipps agreement status. paid_until is left alone. */
export async function setAgreementStatus(
  agreementId: string,
  status: AgreementStatus,
) {
  const { DB } = await getEnv();
  await DB.prepare(
    "UPDATE agreements SET status = ?2, updated_at = ?3 WHERE id = ?1",
  )
    .bind(agreementId, status, Date.now())
    .run();
}

/** Returns false if this webhook event was already handled. */
export async function claimEvent(input: {
  id: string;
  agreementId: string;
  eventType: string;
  occurredAt: number;
}) {
  const { DB } = await getEnv();
  const result = await DB.prepare(
    `INSERT INTO vipps_events (id, agreement_id, event_type, occurred_at, received_at)
     VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT (id) DO NOTHING`,
  )
    .bind(
      input.id,
      input.agreementId,
      input.eventType,
      input.occurredAt,
      Date.now(),
    )
    .run();
  return result.meta.changes > 0;
}
