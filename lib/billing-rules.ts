// The pure billing rules: no imports, no database, no network. They live in
// their own file so `npm test` can run them without any Next.js setup.
// billing.ts re-exports what the rest of the app uses.

export const DAY = 86_400_000;
/** Days Vipps keeps retrying a failed charge. */
export const RETRY_DAYS = 3;
export const BAND_GRACE_DAYS = 3;
export const BAND_LOCKED_DAYS = 30;

export type BandState = "trial" | "active" | "locked" | "closed";

/**
 * Where a band is in its plan:
 * - trial: has never paid (building its room; going live is a later step)
 * - active: paid, or within 3 days of the paid period ending
 * - locked: studio locked, fans still listen (up to 30 days)
 * - closed: room closed for fans, no more fan charges
 */
export function bandStateFrom(
  paidUntil: number | null,
  now = Date.now(),
): BandState {
  if (paidUntil === null) return "trial";
  if (now < paidUntil + BAND_GRACE_DAYS * DAY) return "active";
  if (now < paidUntil + (BAND_GRACE_DAYS + BAND_LOCKED_DAYS) * DAY)
    return "locked";
  return "closed";
}

/** A date as YYYY-MM-DD in Norwegian time (what Vipps expects for `due`). */
export function osloDate(ms: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ms);
}

/**
 * The due date for renewing a period that ends at `periodEnd`: the day
 * before, so the money is in before access would run out. Vipps needs it to
 * be at least tomorrow.
 */
export function dueDateFor(periodEnd: number, now = Date.now()) {
  const wanted = osloDate(periodEnd - DAY);
  const earliest = osloDate(now + DAY);
  return wanted < earliest ? earliest : wanted;
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

/**
 * Where the paid period ends after a payment. A monthly renewal (one of our
 * charges, with `periodStart`) that arrives on time continues the period
 * seamlessly; a first payment or a late one (after retries) starts a fresh
 * month from when the money was taken.
 */
export function nextPaidUntil(capturedAt: number, periodStart?: number) {
  const onTime = periodStart !== undefined && capturedAt <= periodStart + DAY;
  return addMonth(onTime ? periodStart : capturedAt);
}

/**
 * What a fan sees for one subscription:
 * - active: paid and renewing
 * - cancelling: cancelled, but the paid month is still running
 * - payment_failed: should have renewed but the money never came
 * - room_closed: the band stopped paying; the room is closed for everyone
 * - ended: over
 * - pending: started but not paid yet
 */
export type FanSubscriptionState =
  | "active"
  | "cancelling"
  | "payment_failed"
  | "room_closed"
  | "ended"
  | "pending";

export function fanSubscriptionState(
  input: {
    status: string;
    paidUntil: number | null;
    bandState: BandState;
  },
  now = Date.now(),
): FanSubscriptionState {
  const { status, paidUntil, bandState } = input;
  if (paidUntil === null) return status === "PENDING" ? "pending" : "ended";
  if (bandState === "closed") return "room_closed";
  if (paidUntil > now) return status === "ACTIVE" ? "active" : "cancelling";
  return status === "ACTIVE" ? "payment_failed" : "ended";
}
