import {
  markPaid,
  setAgreementStatus,
  type AgreementKind,
} from "@/lib/agreements";
import { getEnv } from "@/lib/cf";
import type { Band } from "@/lib/access";
import {
  getAccount,
  getCheckoutSession,
  stripeEnabled,
  type CheckoutSession,
} from "@/lib/stripe";

// Keeps our `agreements` table in step with Stripe subscriptions. Access works
// exactly as for Vipps: it follows agreements.paid_until.

/** Metadata we put on every Checkout session and subscription. */
export type CheckoutMeta = {
  user_id: string;
  band_id: string;
  kind: AgreementKind;
  amount_ore: string;
};

/**
 * Records a finished Checkout session: creates the agreement row (id = the
 * Stripe subscription id) and, if the first month is paid, opens access.
 * Called from the webhook and when the user returns, so it must be safe to
 * run twice.
 */
export async function syncCheckoutSession(
  session: CheckoutSession,
  account?: string,
) {
  if (session.status !== "complete" || !session.subscription) return null;
  const meta = session.metadata as Partial<CheckoutMeta>;
  if (!meta.user_id || !meta.band_id || !meta.kind) return null;
  const { DB } = await getEnv();
  const now = Date.now();
  await DB.prepare(
    `INSERT INTO agreements (id, kind, user_id, band_id, status, amount_ore, provider, stripe_account, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, 'ACTIVE', ?5, 'stripe', ?6, ?7, ?7)
     ON CONFLICT (id) DO NOTHING`,
  )
    .bind(
      session.subscription,
      meta.kind,
      meta.user_id,
      meta.band_id,
      Number(meta.amount_ore ?? 0),
      account ?? null,
      now,
    )
    .run();
  if (session.payment_status === "paid")
    await markFirstPayment(session.subscription, now);
  return session.subscription;
}

/** Re-reads a Checkout session from Stripe and syncs it. */
export async function syncCheckoutSessionById(id: string, account?: string) {
  return syncCheckoutSession(await getCheckoutSession(id, account), account);
}

/** Opens the first paid month once, whichever of webhook/return comes first. */
export async function markFirstPayment(subscriptionId: string, paidAt: number) {
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT paid_until FROM agreements WHERE id = ?1`,
  )
    .bind(subscriptionId)
    .first<{ paid_until: number | null }>();
  if (row && row.paid_until === null) await markPaid(subscriptionId, paidAt);
}

type Invoice = {
  billing_reason?: string;
  created?: number;
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string } };
  status_transitions?: { paid_at?: number | null };
  lines?: { data?: { period?: { start?: number } }[] };
};

/** invoice.paid: the first month or a monthly renewal. */
export async function handleInvoicePaid(invoice: Invoice) {
  const subscriptionId =
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;
  const paidAt =
    (invoice.status_transitions?.paid_at ??
      invoice.created ??
      Date.now() / 1000) * 1000;
  if (invoice.billing_reason === "subscription_cycle") {
    const start = invoice.lines?.data?.[0]?.period?.start;
    await markPaid(subscriptionId, paidAt, start ? start * 1000 : undefined);
  } else if (invoice.billing_reason === "subscription_create") {
    await markFirstPayment(subscriptionId, paidAt);
  }
}

/** Cancelled (now or at period end): access runs to the end of the paid month. */
export async function handleSubscriptionChange(subscription: {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
}) {
  const stopped =
    subscription.status === "canceled" || subscription.cancel_at_period_end;
  await setAgreementStatus(subscription.id, stopped ? "STOPPED" : "ACTIVE");
}

/** account.updated: can the band take card payments yet? */
export async function handleAccountUpdated(account: {
  id: string;
  charges_enabled: boolean;
}) {
  const { DB } = await getEnv();
  await DB.prepare(
    `UPDATE bands SET stripe_charges_enabled = ?2 WHERE stripe_account_id = ?1`,
  )
    .bind(account.id, account.charges_enabled ? 1 : 0)
    .run();
}

/** Returns false if this Stripe event was already handled. */
export async function claimStripeEvent(id: string, type: string) {
  const { DB } = await getEnv();
  const result = await DB.prepare(
    `INSERT INTO stripe_events (id, type, received_at) VALUES (?1, ?2, ?3)
     ON CONFLICT (id) DO NOTHING`,
  )
    .bind(id, type, Date.now())
    .run();
  return result.meta.changes > 0;
}

export async function releaseStripeEvent(id: string) {
  const { DB } = await getEnv();
  await DB.prepare(`DELETE FROM stripe_events WHERE id = ?1`).bind(id).run();
}

/**
 * While a band's Stripe account isn't ready to take payments, re-check it
 * (the account.updated webhook normally does this; locally it can't arrive).
 */
export async function refreshBandStripe(band: Band): Promise<Band> {
  if (
    !band.stripe_account_id ||
    band.stripe_charges_enabled ||
    !stripeEnabled()
  )
    return band;
  try {
    const account = await getAccount(band.stripe_account_id);
    if (!account.charges_enabled) return band;
    await handleAccountUpdated(account);
    return { ...band, stripe_charges_enabled: 1 };
  } catch (error) {
    console.error("Stripe account check failed", error);
    return band;
  }
}
