import { vippsFake } from "@/lib/vipps";
import type { VippsOrderStatus } from "@/lib/payout-rules";
import { isVippsOrderStatus } from "@/lib/payout-rules";

// Vipps MobilePay Management API with Listening Rooms' *partner* keys: we
// prefill each band's application (product order) and follow it until Vipps
// has approved it and given the band its own sales unit (MSN).
// https://developer.vippsmobilepay.com/docs/APIs/management-api/management-api-guide/
//
// The Management API only exists in production (api.vipps.no), and partner
// keys only work there. Locally, VIPPS_FAKE=true simulates it.

const BASE_URL = "https://api.vipps.no";

/** Whether the partner keys are set (or we're faking Vipps locally). */
export function partnerReady() {
  return (
    vippsFake() ||
    Boolean(
      process.env.VIPPS_PARTNER_CLIENT_ID &&
        process.env.VIPPS_PARTNER_CLIENT_SECRET &&
        process.env.VIPPS_PARTNER_SUBSCRIPTION_KEY,
    )
  );
}

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
      client_id: env("VIPPS_PARTNER_CLIENT_ID"),
      client_secret: env("VIPPS_PARTNER_CLIENT_SECRET"),
      "Ocp-Apim-Subscription-Key": env("VIPPS_PARTNER_SUBSCRIPTION_KEY"),
    },
  });
  if (!response.ok)
    throw new Error(`Vipps partner token failed (${response.status}).`);
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

async function managementFetch<T>(
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Ocp-Apim-Subscription-Key": env("VIPPS_PARTNER_SUBSCRIPTION_KEY"),
      "Content-Type": "application/json",
      "Vipps-System-Name": "listening-rooms",
      "Vipps-System-Version": "0.1.0",
      "Vipps-System-Plugin-Name": "listening-rooms-web",
      "Vipps-System-Plugin-Version": "0.1.0",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Vipps ${init.method} ${path} failed (${response.status}): ${detail}`,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Prefills the band's application for Recurring payments. Returns a link to
 * the business portal, where the band checks the details and signs with
 * BankID. The link expires after 14 days.
 */
export async function prefillProductOrder(input: {
  orgNumber: string;
  salesUnitName: string;
  bankAccount: string;
  websiteUrl: string;
  termsUrl: string;
  intendedPurpose: string;
  fakeReturnUrl: string;
}): Promise<{ orderId: string; url: string }> {
  if (vippsFake()) {
    const orderId = `fake_po_${crypto.randomUUID().replaceAll("-", "")}`;
    return {
      orderId,
      url: `${input.fakeReturnUrl}?order=${encodeURIComponent(orderId)}`,
    };
  }
  const body: Record<string, unknown> = {
    businessIdentifier: { scheme: "business:NO:ORG", id: input.orgNumber },
    salesUnitName: input.salesUnitName.slice(0, 100),
    settlementBankAccount: { scheme: "BBAN:NO", id: input.bankAccount },
    productType: "PAYMENT_INTEGRATION",
    productUseCase: "Website",
    intendedPurpose: input.intendedPurpose,
    website: { url: input.websiteUrl, termsUrl: input.termsUrl },
    hasRecurring: true,
  };
  if (process.env.VIPPS_PARTNER_PRICE_PACKAGE_ID)
    body.pricePackageId = process.env.VIPPS_PARTNER_PRICE_PACKAGE_ID;
  if (process.env.VIPPS_PARTNER_MCC)
    body.merchantCategoryCode = process.env.VIPPS_PARTNER_MCC;
  const data = await managementFetch<{
    prefilledOrderId: string;
    prefillUrl: string;
  }>("/management/v1/product-orders", { method: "POST", body });
  return { orderId: data.prefilledOrderId, url: data.prefillUrl };
}

/** The order's status, and the band's MSN once Vipps has approved it. */
export async function getProductOrder(
  orderId: string,
): Promise<{ status: VippsOrderStatus; msn: string | null } | null> {
  if (vippsFake()) return null; // the fake flow sets the result directly
  const data = await managementFetch<{
    status?: unknown;
    salesUnit?: { msn?: unknown };
  }>(`/management/v2/product-orders/${encodeURIComponent(orderId)}/details`, {
    method: "GET",
  });
  if (!isVippsOrderStatus(data.status)) return null;
  const msn =
    typeof data.salesUnit?.msn === "string" ? data.salesUnit.msn : null;
  return { status: data.status, msn };
}

/** Withdraws a prefilled order the band hasn't submitted yet. */
export async function deleteProductOrder(orderId: string) {
  if (vippsFake()) return;
  await managementFetch<void>(
    `/management/v1/product-orders/${encodeURIComponent(orderId)}`,
    { method: "DELETE" },
  );
}
