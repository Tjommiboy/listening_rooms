// Stripe for everyone outside Norway (they can't use Vipps).
// Plain fetch against the REST API: works on Cloudflare Workers without the
// SDK. Docs: https://docs.stripe.com/api
//
// Money model (same as Vipps): the band is the seller. Each band connects its
// own Stripe account (Connect, Express). A fan subscription is created *on the
// band's account* and Stripe keeps our share automatically as an application
// fee. The band plan is a normal subscription on our own account.

const API = "https://api.stripe.com/v1";
/** Pinned so response shapes don't change under us. */
export const STRIPE_API_VERSION = "2024-06-20";

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  return key;
}

export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

type Params = {
  [key: string]:
    string | number | boolean | undefined | null | Params | Params[];
};

/** Stripe's form encoding: a[b][0][c]=v. */
function encode(params: Params, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value))
      value.forEach((item, i) => encode(item, `${name}[${i}]`, out));
    else if (typeof value === "object") encode(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

export async function stripe<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Params = {},
  options: { account?: string; idempotencyKey?: string } = {},
): Promise<T> {
  const body = encode(params).toString();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey()}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  if (options.account) headers["Stripe-Account"] = options.account;
  if (options.idempotencyKey)
    headers["Idempotency-Key"] = options.idempotencyKey;
  let url = `${API}${path}`;
  const init: RequestInit = { method, headers };
  if (method === "GET") {
    if (body) url += `?${body}`;
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = body;
  }
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok)
    throw new Error(
      `Stripe ${method} ${path} failed (${response.status}): ${data.error?.message ?? ""}`,
    );
  return data;
}

// ---- Connect (bands get paid) ----------------------------------------------

export type StripeAccount = {
  id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
};

export function createBandAccount(input: {
  bandId: string;
  email?: string | null;
}) {
  return stripe<StripeAccount>(
    "POST",
    "/accounts",
    {
      type: "express",
      email: input.email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { band_id: input.bandId },
    },
    { idempotencyKey: `acct-${input.bandId}` },
  );
}

export function getAccount(accountId: string) {
  return stripe<StripeAccount>("GET", `/accounts/${accountId}`);
}

export function createOnboardingLink(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return stripe<{ url: string }>("POST", "/account_links", {
    account: input.accountId,
    refresh_url: input.refreshUrl,
    return_url: input.returnUrl,
    type: "account_onboarding",
  });
}

// ---- Checkout (subscriptions) ------------------------------------------------

export type CheckoutSession = {
  id: string;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  subscription: string | null;
  url: string | null;
  metadata: Record<string, string>;
};

/**
 * A monthly subscription in Stripe Checkout. With `account`, it is created on
 * the band's connected account and we keep `feePercent` as an application fee.
 */
export function createSubscriptionCheckout(input: {
  account?: string;
  amountOre: number;
  productName: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  feePercent?: number;
  metadata: Record<string, string>;
  locale: "nb" | "en";
}) {
  return stripe<CheckoutSession>(
    "POST",
    "/checkout/sessions",
    {
      mode: "subscription",
      locale: input.locale === "nb" ? "nb" : "en",
      customer_email: input.customerEmail ?? undefined,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "nok",
            unit_amount: input.amountOre,
            recurring: { interval: "month" },
            product_data: { name: input.productName },
          },
        },
      ],
      metadata: input.metadata,
      subscription_data: {
        metadata: input.metadata,
        application_fee_percent: input.feePercent,
      },
    },
    { account: input.account },
  );
}

export function getCheckoutSession(id: string, account?: string) {
  return stripe<CheckoutSession>(
    "GET",
    `/checkout/sessions/${id}`,
    {},
    { account },
  );
}

/** Stops a subscription now (closed rooms). */
export function cancelSubscriptionNow(id: string, account?: string) {
  return stripe<{ id: string }>(
    "DELETE",
    `/subscriptions/${id}`,
    {},
    { account },
  );
}

/** Cancels at the end of the paid month: no more charges, access stays. */
export function cancelSubscriptionAtPeriodEnd(id: string, account?: string) {
  return stripe<{ id: string }>(
    "POST",
    `/subscriptions/${id}`,
    { cancel_at_period_end: true },
    { account },
  );
}

// ---- Webhooks ----------------------------------------------------------------

export type StripeEvent = {
  id: string;
  type: string;
  account?: string;
  data: { object: Record<string, unknown> };
};

/**
 * Checks the Stripe-Signature header (HMAC-SHA256 over "<t>.<body>") against
 * each secret given; events older than 5 minutes are rejected.
 * https://docs.stripe.com/webhooks#verify-manually
 */
export async function verifyStripeSignature(
  body: string,
  header: string | null,
  secrets: string[],
  now = Date.now(),
) {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(t)) > 300) return false;
  for (const secret of secrets) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${t}.${body}`),
    );
    const expected = Array.from(new Uint8Array(mac), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (signatures.some((s) => timingSafeEqual(s, expected))) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
