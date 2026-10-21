import { getEnv } from "@/lib/cf";
import { demoBandPlanEnabled } from "@/lib/demo";
import { cancelSubscriptionNow } from "@/lib/stripe";
import { createCharge, stopAgreement } from "@/lib/vipps";
import {
  bandStateFrom,
  DAY,
  dueDateFor,
  RETRY_DAYS,
  type BandState,
} from "@/lib/billing-rules";

// The pure rules (grace days, due dates, states) live in billing-rules.ts so
// they can be tested on their own. Re-exported for the rest of the app.
export {
  BAND_GRACE_DAYS,
  BAND_LOCKED_DAYS,
  bandStateFrom,
  dueDateFor,
  osloDate,
  RETRY_DAYS,
  type BandState,
} from "@/lib/billing-rules";

// Monthly billing rules (decided 2026-10-12, see the project plan):
// - Vipps Recurring never charges by itself; runMonthlyCharges() creates the
//   next charge for every active agreement a few days before its paid period
//   ends. It runs daily from the Worker's cron trigger.
// - Fans: access ends exactly when the paid period ends (no grace). Vipps
//   retries a failed charge for RETRY_DAYS; access returns once it succeeds.
// - Bands: 3 days' grace, then the studio locks while fans keep listening for
//   30 more days; after that the room closes and fan agreements are stopped.

/** Create the next charge this many days before the paid period ends. */
const CHARGE_AHEAD_DAYS = 4;

export async function getBandState(bandId: string): Promise<BandState> {
  if (demoBandPlanEnabled()) return "active";
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT MAX(paid_until) AS paid_until FROM agreements
      WHERE band_id = ?1 AND kind = 'band_plan'`,
  )
    .bind(bandId)
    .first<{ paid_until: number | null }>();
  return bandStateFrom(row?.paid_until ?? null);
}

type Due = {
  id: string;
  kind: "fan" | "band_plan";
  band_id: string;
  amount_ore: number;
  paid_until: number;
  band_paid_until: number | null;
  band_disabled_at: number | null;
};

export type ChargeRunResult = {
  created: number;
  stopped: number;
  errors: { agreementId: string; message: string }[];
};

/**
 * Creates next month's charge for every active agreement that is due, and
 * stops fan agreements of closed rooms. Safe to run any number of times.
 */
export async function runMonthlyCharges(
  now = Date.now(),
): Promise<ChargeRunResult> {
  const { DB } = await getEnv();
  const result: ChargeRunResult = { created: 0, stopped: 0, errors: [] };

  const stop = async (agreementId: string, reason: string) => {
    try {
      await stopAgreement(agreementId, `stop-${reason}-${agreementId}`);
      await DB.prepare(
        `UPDATE agreements SET status = 'STOPPED', updated_at = ?2 WHERE id = ?1`,
      )
        .bind(agreementId, now)
        .run();
      result.stopped++;
    } catch (error) {
      result.errors.push({ agreementId, message: String(error) });
    }
  };

  // Someone who signed up again after a lapse has a newer, paid agreement:
  // stop the old one so it is never charged alongside the new one.
  const { results: superseded } = await DB.prepare(
    `SELECT a.id FROM agreements a
      WHERE a.status = 'ACTIVE' AND a.provider = 'vipps'
        AND EXISTS (SELECT 1 FROM agreements b
                     WHERE b.user_id = a.user_id AND b.band_id = a.band_id
                       AND b.kind = a.kind AND b.id <> a.id
                       AND b.created_at > a.created_at
                       AND b.paid_until IS NOT NULL)`,
  ).all<{ id: string }>();
  for (const { id } of superseded) await stop(id, "superseded");

  // Active agreements whose paid period ends within CHARGE_AHEAD_DAYS (or has
  // ended within the last month) and that have no charge for that period yet.
  const { results } = await DB.prepare(
    `SELECT a.id, a.kind, a.band_id, a.amount_ore, a.paid_until,
            (SELECT MAX(p.paid_until) FROM agreements p
              WHERE p.band_id = a.band_id AND p.kind = 'band_plan') AS band_paid_until,
            (SELECT b.disabled_at FROM bands b WHERE b.id = a.band_id) AS band_disabled_at
       FROM agreements a
      WHERE a.status = 'ACTIVE' AND a.provider = 'vipps'
        AND a.paid_until IS NOT NULL
        AND a.paid_until <= ?1
        AND a.paid_until > ?2
        AND NOT EXISTS (SELECT 1 FROM charges c
                         WHERE c.agreement_id = a.id AND c.period_start = a.paid_until)`,
  )
    .bind(now + CHARGE_AHEAD_DAYS * DAY, now - 31 * DAY)
    .all<Due>();

  for (const row of results) {
    // A room an admin switched off takes no new money from its fans. Nothing
    // is stopped, so it can be switched back on without anyone signing up again.
    if (row.kind === "fan" && row.band_disabled_at) continue;

    // A closed room takes no more money from its fans.
    if (
      row.kind === "fan" &&
      !demoBandPlanEnabled() &&
      bandStateFrom(row.band_paid_until, now) === "closed"
    ) {
      await stop(row.id, "closed");
      continue;
    }

    const chargeId = `chg_${row.id}_${row.paid_until}`;
    const due = dueDateFor(row.paid_until, now);
    // Claim the period first: the UNIQUE (agreement, period) constraint means
    // a parallel run can't create a second charge for it.
    const claimed = await DB.prepare(
      `INSERT INTO charges (id, agreement_id, period_start, due, amount_ore, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'CREATING', ?6, ?6)
       ON CONFLICT DO NOTHING`,
    )
      .bind(chargeId, row.id, row.paid_until, due, row.amount_ore, now)
      .run();
    if (claimed.meta.changes === 0) continue;

    try {
      const { chargeId: vippsId } = await createCharge({
        agreementId: row.id,
        amountOre: row.amount_ore,
        description:
          row.kind === "fan"
            ? "Listening Rooms – medlemskap"
            : "Listening Rooms – bandplan",
        due,
        retryDays: RETRY_DAYS,
        // Same key on retries, so Vipps never creates it twice either.
        idempotencyKey: chargeId,
      });
      await DB.prepare(
        `UPDATE charges SET vipps_id = ?2, status = 'PENDING', updated_at = ?3 WHERE id = ?1`,
      )
        .bind(chargeId, vippsId, Date.now())
        .run();
      result.created++;
    } catch (error) {
      // Release the claim so tomorrow's run tries again.
      await DB.prepare(
        `DELETE FROM charges WHERE id = ?1 AND status = 'CREATING'`,
      )
        .bind(chargeId)
        .run();
      result.errors.push({ agreementId: row.id, message: String(error) });
    }
  }
  // Stripe renews by itself; we only stop fan subscriptions of closed rooms.
  if (!demoBandPlanEnabled()) {
    const { results: stripeFans } = await DB.prepare(
      `SELECT a.id, a.stripe_account,
              (SELECT MAX(p.paid_until) FROM agreements p
                WHERE p.band_id = a.band_id AND p.kind = 'band_plan') AS band_paid_until
         FROM agreements a
        WHERE a.provider = 'stripe' AND a.kind = 'fan' AND a.status = 'ACTIVE'`,
    ).all<{
      id: string;
      stripe_account: string | null;
      band_paid_until: number | null;
    }>();
    for (const row of stripeFans) {
      if (bandStateFrom(row.band_paid_until, now) !== "closed") continue;
      try {
        await cancelSubscriptionNow(row.id, row.stripe_account ?? undefined);
        await DB.prepare(
          `UPDATE agreements SET status = 'STOPPED', updated_at = ?2 WHERE id = ?1`,
        )
          .bind(row.id, now)
          .run();
        result.stopped++;
      } catch (error) {
        result.errors.push({ agreementId: row.id, message: String(error) });
      }
    }
  }
  return result;
}

/** The charge we created for a Vipps chargeId, if it's one of ours. */
export async function findCharge(vippsId: string) {
  const { DB } = await getEnv();
  return DB.prepare(
    `SELECT id, agreement_id, period_start FROM charges WHERE vipps_id = ?1`,
  )
    .bind(vippsId)
    .first<{ id: string; agreement_id: string; period_start: number }>();
}

export async function setChargeStatus(
  vippsId: string,
  status: "CAPTURED" | "FAILED" | "CANCELLED",
) {
  const { DB } = await getEnv();
  await DB.prepare(
    `UPDATE charges SET status = ?2, updated_at = ?3 WHERE vipps_id = ?1`,
  )
    .bind(vippsId, status, Date.now())
    .run();
}
