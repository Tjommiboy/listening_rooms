import { NextRequest, NextResponse } from "next/server";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";
import {
  getPayoutView,
  saveBankAccount,
  saveOrgNumber,
  startVippsOrder,
  type PayoutError,
} from "@/lib/payout";
import { appOrigin } from "@/lib/redirect";
import { requireBandOwner } from "@/lib/storage";

// The "Get paid" wizard (/studio/betaling).
//   GET                          → the wizard's state (refreshes an open Vipps application)
//   POST { action: "org", value }  → check and save the organisation number
//   POST { action: "bank", value } → save the business bank account number
//   POST { action: "vipps" }       → prefill the Vipps application, returns { url }

const STATUS: Record<PayoutError, number> = {
  org_invalid: 400,
  org_not_found: 404,
  org_unavailable: 503,
  org_problem: 409,
  bank_invalid: 400,
  locked: 409,
  missing_details: 409,
  vipps_not_ready: 503,
  vipps_failed: 502,
};

export async function GET() {
  const ctx = await requireBandOwner({ readOnly: true });
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ view: await getPayoutView(ctx.band.id) });
}

export async function POST(request: NextRequest) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const t = await getT();
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    value?: unknown;
  };
  const fail = (error: PayoutError) =>
    NextResponse.json(
      { error: t.payout.errors[error], code: error },
      { status: STATUS[error] },
    );

  switch (body.action) {
    case "org": {
      const result = await saveOrgNumber(ctx.band.id, body.value);
      return result.ok ? NextResponse.json({ view: result.view }) : fail(result.error);
    }
    case "bank": {
      const result = await saveBankAccount(ctx.band.id, body.value);
      return result.ok ? NextResponse.json({ view: result.view }) : fail(result.error);
    }
    case "vipps": {
      const result = await startVippsOrder({
        bandId: ctx.band.id,
        origin: appOrigin(request.nextUrl.origin),
        // Vipps reads the application in Norwegian, whatever the band's language.
        purpose: dictionaries.nb.payout.vippsPurpose,
      });
      return result.ok ? NextResponse.json({ url: result.url }) : fail(result.error);
    }
    default:
      return NextResponse.json({ error: t.errors.notAvailable }, { status: 400 });
  }
}
