import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getBandByOwner, getBandBySlug } from "@/lib/access";
import {
  latestAgreement,
  markPaid,
  setAgreementStatus,
} from "@/lib/agreements";
import { getCurrentUser } from "@/lib/session";
import { getAgreement } from "@/lib/vipps";

// Called when the user returns from Vipps (?slug=x for fans, ?plan=band for
// bands). Asks Vipps for the latest status and syncs it, so access opens right
// away even if the webhook is slow (or can't reach localhost).
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: (await getT()).errors.loginFirst },
      { status: 401 },
    );
  const params = request.nextUrl.searchParams;
  const kind = params.get("plan") === "band" ? "band_plan" : "fan";
  const band =
    kind === "band_plan"
      ? await getBandByOwner(user.id)
      : await getBandBySlug(params.get("slug") ?? "");
  if (!band)
    return NextResponse.json(
      { error: (await getT()).errors.roomNotFound },
      { status: 404 },
    );

  const row = await latestAgreement(user.id, band.id, kind);
  if (!row)
    return NextResponse.json(
      { error: (await getT()).errors.noAgreement },
      { status: 404 },
    );

  try {
    const agreement = await getAgreement(row.id);
    if (agreement.status !== row.status)
      await setAgreementStatus(row.id, agreement.status);
    // The first month is charged when the agreement is approved
    // (initialCharge, DIRECT_CAPTURE). The webhook confirms it too; markPaid
    // is safe to call twice.
    if (agreement.status === "ACTIVE" && row.paid_until === null)
      await markPaid(row.id, Date.now());
    return NextResponse.json({ status: agreement.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : (await getT()).errors.vippsRead;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
