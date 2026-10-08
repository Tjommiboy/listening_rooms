import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Vipps MobilePay Recurring API client (server-side only).
// Docs: https://developer.vippsmobilepay.com/docs/APIs/recurring-api/

const BASE_URL =
  process.env.VIPPS_ENV === "production"
    ? "https://api.vipps.no"
    : "https://apitest.vipps.no";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} er ikke satt.`);
  return value;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000)
    return cachedToken.value;
  const response = await fetch(`${BASE_URL}/accesstoken/get`, {
    method: "POST",
    headers: {
      client_id: env("VIPPS_CLIENT_ID"),
      client_secret: env("VIPPS_CLIENT_SECRET"),
      "Ocp-Apim-Subscription-Key": env("VIPPS_SUBSCRIPTION_KEY"),
      "Merchant-Serial-Number": env("VIPPS_MSN"),
    },
  });
  if (!response.ok)
    throw new Error(`Vipps access token failed (${response.status}).`);
  const data = (await response.json()) as {
    access_token: string;
    expires_in: string | number;
  };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
  return cachedToken.value;
}

async function vippsFetch<T>(
  path: string,
  init: { method: string; body?: unknown; idempotencyKey?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getAccessToken()}`,
    "Ocp-Apim-Subscription-Key": env("VIPPS_SUBSCRIPTION_KEY"),
    "Merchant-Serial-Number": env("VIPPS_MSN"),
    "Content-Type": "application/json",
    "Vipps-System-Name": "listening-rooms",
    "Vipps-System-Version": "0.1.0",
    "Vipps-System-Plugin-Name": "listening-rooms-web",
    "Vipps-System-Plugin-Version": "0.1.0",
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Vipps ${init.method} ${path} failed (${response.status}): ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type AgreementStatus = "PENDING" | "ACTIVE" | "STOPPED" | "EXPIRED";

/** Creates a monthly agreement with the first month charged immediately. */
export function createMonthlyAgreement(input: {
  amountKr: number;
  productName: string;
  productDescription?: string;
  redirectUrl: string;
  agreementUrl: string;
  phoneNumber?: string;
  idempotencyKey: string;
}) {
  const amount = Math.round(input.amountKr * 100); // øre
  return vippsFetch<{ agreementId: string; vippsConfirmationUrl: string }>(
    "/recurring/v3/agreements",
    {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        pricing: { amount, currency: "NOK" },
        interval: { unit: "MONTH", count: 1 },
        productName: input.productName,
        productDescription: input.productDescription,
        merchantRedirectUrl: input.redirectUrl,
        merchantAgreementUrl: input.agreementUrl,
        phoneNumber: input.phoneNumber,
        initialCharge: {
          amount,
          description: input.productName,
          transactionType: "DIRECT_CAPTURE",
        },
      },
    },
  );
}

export function getAgreement(agreementId: string) {
  return vippsFetch<{ id: string; status: AgreementStatus }>(
    `/recurring/v3/agreements/${encodeURIComponent(agreementId)}`,
    { method: "GET" },
  );
}

export function stopAgreement(agreementId: string, idempotencyKey: string) {
  return vippsFetch<void>(
    `/recurring/v3/agreements/${encodeURIComponent(agreementId)}`,
    { method: "PATCH", body: { status: "STOPPED" }, idempotencyKey },
  );
}

/** Schedules next month's charge. `due` must be at least one day ahead (YYYY-MM-DD). */
export function createCharge(input: {
  agreementId: string;
  amountKr: number;
  description: string;
  due: string;
  idempotencyKey: string;
}) {
  return vippsFetch<{ chargeId: string }>(
    `/recurring/v3/agreements/${encodeURIComponent(input.agreementId)}/charges`,
    {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: Math.round(input.amountKr * 100),
        transactionType: "DIRECT_CAPTURE",
        description: input.description,
        due: input.due,
        retryDays: 5,
        type: "RECURRING",
      },
    },
  );
}

/**
 * Verifies a Vipps webhook request (HMAC-SHA256).
 * https://developer.vippsmobilepay.com/docs/APIs/webhooks-api/request-authentication/
 */
export function verifyWebhook(input: {
  body: string;
  pathAndQuery: string;
  host: string;
  date: string | null;
  contentSha256: string | null;
  authorization: string | null;
  secret: string;
}) {
  if (!input.date || !input.contentSha256 || !input.authorization) return false;
  const contentHash = createHash("sha256").update(input.body).digest("base64");
  if (contentHash !== input.contentSha256) return false;
  const signed = `POST\n${input.pathAndQuery}\n${input.date};${input.host};${contentHash}`;
  const signature = createHmac("sha256", input.secret)
    .update(signed)
    .digest("base64");
  const expected = Buffer.from(
    `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
  );
  const actual = Buffer.from(input.authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
