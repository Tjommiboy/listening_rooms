import { setAgreementStatus } from "@/lib/agreements";
import {
  bandStateFrom,
  fanSubscriptionState,
  type FanSubscriptionState,
} from "@/lib/billing-rules";
import { getEnv } from "@/lib/cf";
import { demoBandPlanEnabled, demoMembershipEnabled } from "@/lib/demo";
import { cancelSubscriptionAtPeriodEnd } from "@/lib/stripe";
import { stopAgreement } from "@/lib/vipps";

// What a fan sees on their own page: subscriptions, payments, cancelling.

export type FanSubscription = {
  id: string;
  provider: "vipps" | "stripe";
  status: string;
  amountOre: number;
  paidUntil: number | null;
  bandSlug: string;
  bandName: string;
  state: FanSubscriptionState;
};

export type FanPayment = {
  id: string;
  amountOre: number;
  capturedAt: number;
  bandSlug: string;
  bandName: string;
};

type SubscriptionRow = {
  id: string;
  provider: "vipps" | "stripe";
  status: string;
  amount_ore: number;
  paid_until: number | null;
  slug: string;
  name: string;
  band_paid_until: number | null;
};

// When a fan has several agreements for the same band (an old one that ended
// and a new one), only the most relevant one is shown.
const RANK: Record<FanSubscriptionState, number> = {
  active: 0,
  cancelling: 0,
  payment_failed: 1,
  pending: 2,
  room_closed: 3,
  ended: 4,
};

/** The fan's subscriptions, one per band, current ones first. */
export async function listFanSubscriptions(
  userId: string,
  now = Date.now(),
): Promise<FanSubscription[]> {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT a.id, a.provider, a.status, a.amount_ore, a.paid_until,
            b.slug, b.name,
            (SELECT MAX(p.paid_until) FROM agreements p
              WHERE p.band_id = a.band_id AND p.kind = 'band_plan') AS band_paid_until
       FROM agreements a JOIN bands b ON b.id = a.band_id
      WHERE a.user_id = ?1 AND a.kind = 'fan'
      ORDER BY a.created_at DESC`,
  )
    .bind(userId)
    .all<SubscriptionRow>();

  const bySlug = new Map<string, FanSubscription>();
  for (const row of results) {
    const bandState = demoBandPlanEnabled()
      ? "active"
      : bandStateFrom(row.band_paid_until, now);
    const state = fanSubscriptionState(
      { status: row.status, paidUntil: row.paid_until, bandState },
      now,
    );
    // A signup that never got paid is not worth showing.
    if (state === "pending" && row.status !== "PENDING") continue;
    const subscription: FanSubscription = {
      id: row.id,
      provider: row.provider,
      status: row.status,
      amountOre: row.amount_ore,
      paidUntil: row.paid_until,
      bandSlug: row.slug,
      bandName: row.name,
      state,
    };
    const existing = bySlug.get(row.slug);
    if (!existing || RANK[state] < RANK[existing.state])
      bySlug.set(row.slug, subscription);
  }
  return [...bySlug.values()].sort(
    (a, b) =>
      RANK[a.state] - RANK[b.state] || a.bandName.localeCompare(b.bandName),
  );
}

/** The fan's captured payments, newest first. */
export async function listFanPayments(userId: string): Promise<FanPayment[]> {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT p.id, p.amount_ore, p.captured_at, b.slug, b.name
       FROM payments p
       JOIN agreements a ON a.id = p.agreement_id
       JOIN bands b ON b.id = p.band_id
      WHERE a.user_id = ?1 AND p.kind = 'fan'
      ORDER BY p.captured_at DESC
      LIMIT 100`,
  )
    .bind(userId)
    .all<{
      id: string;
      amount_ore: number;
      captured_at: number;
      slug: string;
      name: string;
    }>();
  return results.map((row) => ({
    id: row.id,
    amountOre: row.amount_ore,
    capturedAt: row.captured_at,
    bandSlug: row.slug,
    bandName: row.name,
  }));
}

export type CancelResult = "cancelled" | "not_found" | "not_active";

/**
 * Cancels a fan subscription: no more charges, access runs to the end of the
 * paid month (hasAccess only looks at paid_until). Only the fan's own
 * subscriptions can be cancelled.
 */
export async function cancelFanSubscription(
  userId: string,
  agreementId: string,
): Promise<CancelResult> {
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT id, provider, status, stripe_account FROM agreements
      WHERE id = ?1 AND user_id = ?2 AND kind = 'fan'`,
  )
    .bind(agreementId, userId)
    .first<{
      id: string;
      provider: "vipps" | "stripe";
      status: string;
      stripe_account: string | null;
    }>();
  if (!row) return "not_found";
  if (row.status !== "ACTIVE") return "not_active";

  // Local test memberships never existed at Vipps.
  const isDemo = demoMembershipEnabled() && row.id.startsWith("demo_");
  if (!isDemo) {
    if (row.provider === "stripe")
      await cancelSubscriptionAtPeriodEnd(
        row.id,
        row.stripe_account ?? undefined,
      );
    else await stopAgreement(row.id, `stop-user-${row.id}`);
  }
  await setAgreementStatus(row.id, "STOPPED");
  return "cancelled";
}
