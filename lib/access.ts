import { getEnv } from "@/lib/cf";
import { demoBandPlanEnabled } from "@/lib/demo";

/** Days of access kept after a failed renewal while Vipps retries. */
export const GRACE_DAYS = 3;
const GRACE_MS = GRACE_DAYS * 86_400_000;

export type Band = {
  id: string;
  slug: string;
  name: string;
  owner_id: string | null;
  member_price_kr: number;
  bucket_name: string | null;
};

export async function getBandBySlug(slug: string) {
  const { DB } = await getEnv();
  return DB.prepare(
    "SELECT id, slug, name, owner_id, member_price_kr, bucket_name FROM bands WHERE slug = ?1",
  )
    .bind(slug)
    .first<Band>();
}

export async function getBandByOwner(userId: string) {
  const { DB } = await getEnv();
  return DB.prepare(
    "SELECT id, slug, name, owner_id, member_price_kr, bucket_name FROM bands WHERE owner_id = ?1",
  )
    .bind(userId)
    .first<Band>();
}

/**
 * The one rule for streaming: may this user hear this band's material?
 * Yes if they own the band, or have a fan agreement paid up to now (+ grace).
 * A stopped agreement keeps access until the paid month runs out.
 */
export async function hasAccess(userId: string | undefined, band: Band) {
  if (!userId) return false;
  if (band.owner_id === userId) return true;
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT 1 FROM agreements
      WHERE user_id = ?1 AND band_id = ?2 AND kind = 'fan'
        AND paid_until IS NOT NULL AND paid_until + ?3 > ?4
      LIMIT 1`,
  )
    .bind(userId, band.id, GRACE_MS, Date.now())
    .first();
  return row !== null;
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
    .bind(bandId, GRACE_MS, Date.now())
    .first();
  return row !== null;
}

/** Adds one month to a timestamp (calendar month, clamped like Vipps does). */
export function addMonth(ms: number) {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.getTime();
}
