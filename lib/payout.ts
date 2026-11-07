import { getEnv } from "@/lib/cf";
import { lookupOrg } from "@/lib/brreg";
import {
  canEditPayoutDetails,
  digitsOnly,
  effectiveOrderStatus,
  isFinalOrderStatus,
  isValidBankAccount,
  isValidOrgNumber,
  isVippsOrderStatus,
  orgProblem,
  payoutSteps,
  shouldRefreshOrder,
  type OrgProblem,
  type VippsOrderStatus,
} from "@/lib/payout-rules";
import {
  deleteProductOrder,
  getProductOrder,
  partnerReady,
  prefillProductOrder,
} from "@/lib/vipps-partner";
import { vippsFake } from "@/lib/vipps";

// The "Get paid" wizard (/studio/betaling): everything a band in Norway needs
// before fans can pay it through Vipps. The band is the seller, so it needs
// its own organisation number, business bank account and Vipps sales unit.
// We check, prefill and track; the band signs in Altinn, at its bank and in
// Vipps itself. Rules without database access are in lib/payout-rules.ts.

type Row = {
  id: string;
  slug: string;
  name: string;
  member_price_kr: number;
  org_number: string | null;
  org_name: string | null;
  org_form: string | null;
  org_owner_name: string | null;
  org_checked_at: number | null;
  payout_account: string | null;
  vipps_order_id: string | null;
  vipps_order_url: string | null;
  vipps_order_status: string | null;
  vipps_order_created_at: number | null;
  vipps_order_checked_at: number | null;
  vipps_msn: string | null;
  live_approved_at: number | null;
};

export type PayoutError =
  | "org_invalid"
  | "org_not_found"
  | "org_unavailable"
  | "org_problem"
  | "bank_invalid"
  | "locked"
  | "missing_details"
  | "vipps_not_ready"
  | "vipps_failed";

export type PayoutView = ReturnType<typeof toView>;

async function readRow(bandId: string) {
  const { DB } = await getEnv();
  return DB.prepare(
    `SELECT id, slug, name, member_price_kr, org_number, org_name, org_form, org_owner_name,
            org_checked_at, payout_account, vipps_order_id, vipps_order_url, vipps_order_status,
            vipps_order_created_at, vipps_order_checked_at, vipps_msn, live_approved_at
       FROM bands WHERE id = ?1`,
  )
    .bind(bandId)
    .first<Row>();
}

function orderStatus(row: Row, now: number): VippsOrderStatus | null {
  if (!isVippsOrderStatus(row.vipps_order_status)) return null;
  return effectiveOrderStatus(
    row.vipps_order_status,
    row.vipps_order_created_at ?? now,
    now,
  );
}

function problemOf(row: Row): OrgProblem | null {
  // An org number Brønnøysund won't accept is saved with "!<problem>" in
  // org_form (e.g. "!bankrupt"), so the wizard can say why.
  if (!row.org_number) return null;
  if (row.org_form?.startsWith("!")) return row.org_form.slice(1) as OrgProblem;
  return null;
}

function toView(row: Row, now = Date.now()) {
  const status = orderStatus(row, now);
  const problem = problemOf(row);
  const steps = payoutSteps({
    orgNumber: row.org_number,
    orgOk: Boolean(row.org_number) && problem === null,
    payoutAccount: row.payout_account,
    orderStatus: status,
    msn: row.vipps_msn,
    liveApproved: row.live_approved_at !== null,
  });
  return {
    steps,
    org: row.org_number
      ? {
          number: row.org_number,
          name: row.org_name ?? "",
          form: problem ? "" : (row.org_form ?? ""),
          ownerName: row.org_owner_name,
          problem,
        }
      : null,
    bankAccountLast5: row.payout_account ? row.payout_account.slice(6) : null,
    vipps: {
      status,
      url:
        status === "RECEIVED" || status === "MERCHANT_VIEWED"
          ? row.vipps_order_url
          : null,
      msn: row.vipps_msn,
    },
    canEdit: canEditPayoutDetails(status) && !row.vipps_msn,
    liveApproved: row.live_approved_at !== null,
    partnerReady: partnerReady(),
    fake: vippsFake(),
  };
}

/** Asks Vipps for news about an open application (at most every 5 minutes). */
async function refreshOrder(row: Row, now: number) {
  const status = orderStatus(row, now);
  if (!row.vipps_order_id || !status) return row;
  const { DB } = await getEnv();
  if (status === "EXPIRED" && row.vipps_order_status !== "EXPIRED") {
    await DB.prepare(
      "UPDATE bands SET vipps_order_status = 'EXPIRED' WHERE id = ?1",
    )
      .bind(row.id)
      .run();
    return { ...row, vipps_order_status: "EXPIRED" };
  }
  if (!shouldRefreshOrder(status, row.vipps_order_checked_at, now)) return row;
  if (vippsFake() || !partnerReady()) return row;
  try {
    const result = await getProductOrder(row.vipps_order_id);
    if (!result) return row;
    const msn = result.status === "COMPLETED" ? result.msn : null;
    await DB.prepare(
      `UPDATE bands SET vipps_order_status = ?2, vipps_order_checked_at = ?3,
              vipps_msn = COALESCE(?4, vipps_msn)
        WHERE id = ?1`,
    )
      .bind(row.id, result.status, now, msn)
      .run();
    return {
      ...row,
      vipps_order_status: result.status,
      vipps_order_checked_at: now,
      vipps_msn: msn ?? row.vipps_msn,
    };
  } catch (error) {
    console.error("Vipps product order refresh failed", error);
    await DB.prepare("UPDATE bands SET vipps_order_checked_at = ?2 WHERE id = ?1")
      .bind(row.id, now)
      .run();
    return row;
  }
}

/** The wizard's state for a band, refreshing an open Vipps application. */
export async function getPayoutView(bandId: string) {
  const row = await readRow(bandId);
  if (!row) return null;
  const now = Date.now();
  return toView(await refreshOrder(row, now), now);
}

/**
 * Org number or bank account changed: an unsubmitted Vipps application has
 * the old details, so withdraw it and let the band start that step again.
 */
async function dropOpenOrder(row: Row) {
  if (!row.vipps_order_id) return;
  const status = orderStatus(row, Date.now());
  if (status && !isFinalOrderStatus(status) && status !== "ORDER_SUBMITTED")
    await deleteProductOrder(row.vipps_order_id).catch((error) =>
      console.error("Could not withdraw Vipps product order", error),
    );
  const { DB } = await getEnv();
  await DB.prepare(
    `UPDATE bands SET vipps_order_id = NULL, vipps_order_url = NULL, vipps_order_status = NULL,
            vipps_order_created_at = NULL, vipps_order_checked_at = NULL
      WHERE id = ?1`,
  )
    .bind(row.id)
    .run();
}

type Result = { ok: true; view: PayoutView } | { ok: false; error: PayoutError };

async function editable(bandId: string) {
  const row = await readRow(bandId);
  if (!row) return null;
  const status = orderStatus(row, Date.now());
  return canEditPayoutDetails(status) && !row.vipps_msn ? row : "locked";
}

export async function saveOrgNumber(bandId: string, raw: unknown): Promise<Result> {
  const orgNumber = digitsOnly(raw);
  if (!isValidOrgNumber(orgNumber)) return { ok: false, error: "org_invalid" };
  const row = await editable(bandId);
  if (row === "locked") return { ok: false, error: "locked" };
  if (!row) return { ok: false, error: "org_invalid" };

  const lookup = await lookupOrg(orgNumber);
  if ("unavailable" in lookup) return { ok: false, error: "org_unavailable" };
  if (!lookup.found) return { ok: false, error: "org_not_found" };
  const problem = orgProblem(lookup.org);

  if (row.org_number !== orgNumber) await dropOpenOrder(row);
  const { DB } = await getEnv();
  await DB.prepare(
    `UPDATE bands SET org_number = ?2, org_name = ?3, org_form = ?4, org_owner_name = ?5,
            org_checked_at = ?6
      WHERE id = ?1`,
  )
    .bind(
      bandId,
      orgNumber,
      lookup.org.name || null,
      problem ? `!${problem}` : lookup.org.form || null,
      lookup.org.ownerName,
      Date.now(),
    )
    .run();
  const view = await getPayoutView(bandId);
  if (!view) return { ok: false, error: "org_invalid" };
  return problem ? { ok: false, error: "org_problem" } : { ok: true, view };
}

export async function saveBankAccount(bandId: string, raw: unknown): Promise<Result> {
  const account = digitsOnly(raw);
  if (!isValidBankAccount(account)) return { ok: false, error: "bank_invalid" };
  const row = await editable(bandId);
  if (row === "locked") return { ok: false, error: "locked" };
  if (!row) return { ok: false, error: "bank_invalid" };
  if (row.payout_account !== account) await dropOpenOrder(row);
  const { DB } = await getEnv();
  await DB.prepare("UPDATE bands SET payout_account = ?2 WHERE id = ?1")
    .bind(bandId, account)
    .run();
  const view = await getPayoutView(bandId);
  return view ? { ok: true, view } : { ok: false, error: "bank_invalid" };
}

/**
 * Prefills the band's Vipps application and returns the link where the band
 * checks and signs it. Reuses an open application instead of making a new one.
 */
export async function startVippsOrder(input: {
  bandId: string;
  origin: string;
  purpose: (priceKr: number) => string;
}): Promise<{ ok: true; url: string } | { ok: false; error: PayoutError }> {
  const row = await readRow(input.bandId);
  if (!row) return { ok: false, error: "missing_details" };
  if (row.vipps_msn) return { ok: false, error: "locked" };
  if (!row.org_number || problemOf(row) || !row.payout_account)
    return { ok: false, error: "missing_details" };
  if (!partnerReady()) return { ok: false, error: "vipps_not_ready" };

  const now = Date.now();
  const status = orderStatus(row, now);
  if (status === "ORDER_SUBMITTED") return { ok: false, error: "locked" };
  if (
    (status === "RECEIVED" || status === "MERCHANT_VIEWED") &&
    row.vipps_order_url
  )
    return { ok: true, url: row.vipps_order_url };

  try {
    const order = await prefillProductOrder({
      orgNumber: row.org_number,
      salesUnitName: row.name,
      bankAccount: row.payout_account,
      websiteUrl: `${input.origin}/room/${row.slug}`,
      termsUrl: `${input.origin}/vilkar`,
      intendedPurpose: input.purpose(row.member_price_kr),
      fakeReturnUrl: `${input.origin}/studio/betaling/vipps-test`,
    });
    const { DB } = await getEnv();
    await DB.prepare(
      `UPDATE bands SET vipps_order_id = ?2, vipps_order_url = ?3, vipps_order_status = 'RECEIVED',
              vipps_order_created_at = ?4, vipps_order_checked_at = ?4
        WHERE id = ?1`,
    )
      .bind(row.id, order.orderId, order.url, now)
      .run();
    return { ok: true, url: order.url };
  } catch (error) {
    console.error("Vipps prefill failed", error);
    return { ok: false, error: "vipps_failed" };
  }
}

/** Local testing only (VIPPS_FAKE): pretend Vipps approved or rejected. */
export async function fakeVippsResult(
  bandId: string,
  orderId: string,
  approve: boolean,
) {
  if (!vippsFake()) return false;
  const { DB } = await getEnv();
  const msn = approve
    ? `fake${crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000}`
    : null;
  const result = await DB.prepare(
    `UPDATE bands SET vipps_order_status = ?3, vipps_order_checked_at = ?4,
            vipps_msn = COALESCE(?5, vipps_msn)
      WHERE id = ?1 AND vipps_order_id = ?2`,
  )
    .bind(bandId, orderId, approve ? "COMPLETED" : "REJECTED", Date.now(), msn)
    .run();
  return result.meta.changes > 0;
}

export type GoLiveCandidate = {
  id: string;
  slug: string;
  name: string;
  orgNumber: string | null;
  orgName: string | null;
  vippsMsn: string | null;
  vippsStatus: string | null;
  stripeReady: boolean;
  planPaid: boolean;
  approvedAt: number | null;
  disabled: boolean;
};

/** For admins: bands that have started getting paid, newest first. */
export async function listGoLiveCandidates(): Promise<GoLiveCandidate[]> {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT b.id, b.slug, b.name, b.org_number, b.org_name, b.vipps_msn, b.vipps_order_status,
            b.stripe_charges_enabled, b.live_approved_at, b.disabled_at,
            EXISTS (SELECT 1 FROM agreements a
                     WHERE a.band_id = b.id AND a.kind = 'band_plan'
                       AND a.paid_until IS NOT NULL AND a.paid_until > ?1) AS plan_paid
       FROM bands b
      WHERE b.owner_id IS NOT NULL
        AND (b.org_number IS NOT NULL OR b.stripe_charges_enabled = 1 OR b.live_approved_at IS NOT NULL)
      ORDER BY b.live_approved_at IS NOT NULL, b.created_at DESC
      LIMIT 200`,
  )
    .bind(Date.now())
    .all<{
      id: string;
      slug: string;
      name: string;
      org_number: string | null;
      org_name: string | null;
      vipps_msn: string | null;
      vipps_order_status: string | null;
      stripe_charges_enabled: number;
      live_approved_at: number | null;
      disabled_at: number | null;
      plan_paid: number;
    }>();
  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    orgNumber: r.org_number,
    orgName: r.org_name,
    vippsMsn: r.vipps_msn,
    vippsStatus: r.vipps_order_status,
    stripeReady: r.stripe_charges_enabled === 1,
    planPaid: r.plan_paid === 1,
    approvedAt: r.live_approved_at,
    disabled: r.disabled_at !== null,
  }));
}
