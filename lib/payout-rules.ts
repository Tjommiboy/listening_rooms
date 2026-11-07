// Pure rules for the "Get paid" wizard: no imports, so they can be tested
// with `npm test`. lib/payout.ts and the wizard both use them.

/** Keeps only the digits ("123 456 789" → "123456789"). */
export function digitsOnly(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

/** Norwegian modulus 11 check digit; null when the number can't be valid. */
function mod11(digits: string, weights: number[]) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += Number(digits[i]) * weights[i];
  const rest = sum % 11;
  if (rest === 0) return 0;
  const check = 11 - rest;
  return check === 10 ? null : check;
}

/** A Norwegian organisation number: 9 digits with a valid check digit. */
export function isValidOrgNumber(value: unknown) {
  const d = digitsOnly(value);
  if (!/^\d{9}$/.test(d)) return false;
  return mod11(d, [3, 2, 7, 6, 5, 4, 3, 2]) === Number(d[8]);
}

/** A Norwegian bank account number: 11 digits with a valid check digit. */
export function isValidBankAccount(value: unknown) {
  const d = digitsOnly(value);
  if (!/^\d{11}$/.test(d)) return false;
  return mod11(d, [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]) === Number(d[10]);
}

export function formatOrgNumber(digits: string) {
  return digits.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
}

export function formatBankAccount(digits: string) {
  return digits.replace(/^(\d{4})(\d{2})(\d{5})$/, "$1 $2 $3");
}

/** Shows only the last digits of an account number. */
export function maskBankAccount(digits: string) {
  return digits.length === 11 ? `•••• •• ${digits.slice(6)}` : "";
}

/** What Brønnøysund says about an organisation, as far as we need it. */
export type OrgInfo = {
  name: string;
  form: string;
  ownerName: string | null;
  deleted: boolean;
  bankrupt: boolean;
  windingUp: boolean;
};

export type OrgProblem = "deleted" | "bankrupt" | "winding_up";

/** Why an organisation can't be used to take payments, or null if it can. */
export function orgProblem(org: OrgInfo): OrgProblem | null {
  if (org.deleted) return "deleted";
  if (org.bankrupt) return "bankrupt";
  if (org.windingUp) return "winding_up";
  return null;
}

function nameParts(name: string) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .split(/[\s\-]+/)
    .filter((part) => part.length > 1);
}

/**
 * Whether the signed-in person looks like the registered owner: their first
 * and last name both appear in the register's name. Only a hint; Vipps does
 * the real check when the band signs with BankID.
 */
export function namesMatch(userName: string | null, ownerName: string | null) {
  if (!userName || !ownerName) return true;
  const user = nameParts(userName);
  const owner = new Set(nameParts(ownerName));
  if (user.length === 0) return true;
  return owner.has(user[0]) && owner.has(user[user.length - 1]);
}

export const VIPPS_ORDER_STATUSES = [
  "RECEIVED",
  "MERCHANT_VIEWED",
  "ORDER_SUBMITTED",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
] as const;
export type VippsOrderStatus = (typeof VIPPS_ORDER_STATUSES)[number];

export function isVippsOrderStatus(value: unknown): value is VippsOrderStatus {
  return (VIPPS_ORDER_STATUSES as readonly unknown[]).includes(value);
}

/** A prefilled Vipps product order expires after 14 days. */
export const VIPPS_ORDER_DAYS = 14;
/** How often we may ask Vipps for news about an open order. */
export const VIPPS_REFRESH_MS = 5 * 60_000;

/** Statuses after which nothing more happens to the order. */
export function isFinalOrderStatus(status: VippsOrderStatus) {
  return status === "COMPLETED" || status === "REJECTED" || status === "EXPIRED";
}

/** The status to show, counting an unopened or unsubmitted order as expired after 14 days. */
export function effectiveOrderStatus(
  status: VippsOrderStatus,
  createdAt: number,
  now: number,
): VippsOrderStatus {
  if (
    (status === "RECEIVED" || status === "MERCHANT_VIEWED") &&
    now - createdAt > VIPPS_ORDER_DAYS * 86_400_000
  )
    return "EXPIRED";
  return status;
}

/** Whether to ask Vipps again for the order's status. */
export function shouldRefreshOrder(
  status: VippsOrderStatus,
  checkedAt: number | null,
  now: number,
) {
  if (isFinalOrderStatus(status)) return false;
  return checkedAt === null || now - checkedAt >= VIPPS_REFRESH_MS;
}

/**
 * Whether the band may still change its org number or bank account. Not
 * once Vipps has the application (submitted or approved): changes then go
 * through Vipps.
 */
export function canEditPayoutDetails(status: VippsOrderStatus | null) {
  return status !== "ORDER_SUBMITTED" && status !== "COMPLETED";
}

export type PayoutSetup = {
  orgNumber: string | null;
  orgOk: boolean;
  payoutAccount: string | null;
  orderStatus: VippsOrderStatus | null;
  msn: string | null;
  liveApproved: boolean;
};

export type StepState = "todo" | "waiting" | "done" | "problem";
export type PayoutSteps = {
  org: StepState;
  bank: StepState;
  vipps: StepState;
  live: StepState;
  /** 1–4: the first step that isn't done (5 when everything is). */
  current: number;
};

/** Where the band is in the wizard. */
export function payoutSteps(s: PayoutSetup): PayoutSteps {
  const org: StepState = s.orgNumber ? (s.orgOk ? "done" : "problem") : "todo";
  const bank: StepState = s.payoutAccount ? "done" : "todo";
  let vipps: StepState = "todo";
  if (s.msn) vipps = "done";
  else if (s.orderStatus === "REJECTED") vipps = "problem";
  else if (s.orderStatus && s.orderStatus !== "EXPIRED") vipps = "waiting";
  const live: StepState = s.liveApproved
    ? "done"
    : vipps === "done"
      ? "waiting"
      : "todo";
  const order = [org, bank, vipps, live];
  const firstOpen = order.findIndex((state) => state !== "done");
  return { org, bank, vipps, live, current: firstOpen === -1 ? 5 : firstOpen + 1 };
}
