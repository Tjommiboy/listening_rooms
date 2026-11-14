import { getEnv } from "@/lib/cf";
import { BAND_GRACE_DAYS, getBandState } from "@/lib/billing";
import { fanSalesBlock, type FanSalesBlock } from "@/lib/billing-rules";
import { demoBandPlanEnabled } from "@/lib/demo";

/** A band's plan keeps working this long after a failed renewal. */
const BAND_GRACE_MS = BAND_GRACE_DAYS * 86_400_000;

export type Band = {
  id: string;
  slug: string;
  name: string;
  owner_id: string | null;
  member_price_kr: number;
  bucket_name: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: number;
  /** Set when a platform admin switched the band off. */
  disabled_at?: number | null;
  /** The band's own Vipps sales unit, once Vipps has approved it. */
  vipps_msn?: string | null;
  /** Set when a platform admin approved the band to go live. */
  live_approved_at?: number | null;
};

export async function getBandBySlug(slug: string) {
  const { DB } = await getEnv();
  return DB.prepare(
    "SELECT id, slug, name, owner_id, member_price_kr, bucket_name, stripe_account_id, stripe_charges_enabled, disabled_at, vipps_msn, live_approved_at FROM bands WHERE slug = ?1",
  )
    .bind(slug)
    .first<Band>();
}

export async function getBandByOwner(userId: string) {
  const { DB } = await getEnv();
  return DB.prepare(
    "SELECT id, slug, name, owner_id, member_price_kr, bucket_name, stripe_account_id, stripe_charges_enabled, disabled_at, vipps_msn, live_approved_at FROM bands WHERE owner_id = ?1",
  )
    .bind(userId)
    .first<Band>();
}

/**
 * The one rule for streaming: may this user hear this band's material?
 * Yes if they own the band, or have a fan agreement paid up to now and the
 * room isn't closed. There's no grace for fans: if a renewal fails, access
 * pauses at the end of the paid month and comes back when a charge succeeds.
 * A cancelled agreement keeps access until the paid month runs out.
 */
export async function hasAccess(userId: string | undefined, band: Band) {
  if (!userId) return false;
  // A band switched off by an admin is silent for everyone, even its owner.
  if (band.disabled_at) return false;
  if (band.owner_id === userId) return true;
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT 1 FROM agreements
      WHERE user_id = ?1 AND band_id = ?2 AND kind = 'fan'
        AND paid_until IS NOT NULL AND paid_until > ?3
      LIMIT 1`,
  )
    .bind(userId, band.id, Date.now())
    .first();
  if (row === null) return false;
  return (await getBandState(band.id)) !== "closed";
}

/**
 * Why this band can't take a new fan payment through this provider, or null
 * when it can. Checked before a Vipps agreement or Stripe Checkout is started.
 */
export async function fanSalesBlockFor(
  band: Band,
  provider: "vipps" | "stripe",
): Promise<FanSalesBlock | null> {
  return fanSalesBlock({
    provider,
    state: await getBandState(band.id),
    disabled: Boolean(band.disabled_at),
    liveApproved: Boolean(band.live_approved_at),
    hasVippsMsn: Boolean(band.vipps_msn),
    stripeReady: Boolean(band.stripe_account_id && band.stripe_charges_enabled),
    vippsProduction: process.env.VIPPS_ENV === "production",
  });
}

/** Whether the band's 49 kr plan is paid, so it may upload. */
export async function bandPlanActive(bandId: string) {
  if (demoBandPlanEnabled()) return true;
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT 1 FROM agreements
      WHERE band_id = ?1 AND kind = 'band_plan'
        AND paid_until IS NOT NULL AND paid_until + ?2 > ?3
      LIMIT 1`,
  )
    .bind(bandId, BAND_GRACE_MS, Date.now())
    .first();
  return row !== null;
}

export { addMonth } from "@/lib/billing-rules";
