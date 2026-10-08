import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getBandByOwner, getBandBySlug, hasAccess } from "@/lib/access";
import { insertPendingAgreement, type AgreementKind } from "@/lib/agreements";
import { ARTIST_PLAN_PRICE_KR } from "@/lib/pricing";
import { appOrigin } from "@/lib/redirect";
import { getCurrentUser } from "@/lib/session";
import { createMonthlyAgreement } from "@/lib/vipps";

// Starts a monthly Vipps agreement for the signed-in user:
//   { slug }           → fan membership of that band's room (19 kr)
//   { plan: "band" }   → the band plan for the band this user owns (49 kr)
// The agreement row is saved as PENDING before the user goes to Vipps, so we
// always know which user and band an agreement belongs to.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: (await getT()).errors.loginFirst },
      { status: 401 },
    );

  const body = (await request.json().catch(() => ({}))) as {
    slug?: unknown;
    plan?: unknown;
  };
  const kind: AgreementKind = body.plan === "band" ? "band_plan" : "fan";
  const band =
    kind === "band_plan"
      ? await getBandByOwner(user.id)
      : typeof body.slug === "string"
        ? await getBandBySlug(body.slug)
        : null;
  if (!band)
    return NextResponse.json(
      { error: (await getT()).errors.roomNotFound },
      { status: 404 },
    );
  if (kind === "fan" && (await hasAccess(user.id, band)))
    return NextResponse.json(
      { error: (await getT()).errors.alreadyAccess },
      { status: 409 },
    );

  const t = await getT();
  const origin = appOrigin(request.nextUrl.origin);
  const amountKr = kind === "fan" ? band.member_price_kr : ARTIST_PLAN_PRICE_KR;
  try {
    const agreement = await createMonthlyAgreement({
      amountKr,
      productName:
        kind === "fan"
          ? t.vipps.fanProduct(band.name)
          : t.vipps.planProduct(band.name),
      productDescription:
        kind === "fan"
          ? t.vipps.fanDescription(band.name)
          : t.vipps.planDescription,
      redirectUrl:
        kind === "fan"
          ? `${origin}/room/${band.slug}?vipps=retur`
          : `${origin}/studio?vipps=retur`,
      agreementUrl: `${origin}/vilkar`,
      phoneNumber: user.phone ?? undefined,
      idempotencyKey: randomUUID(),
    });
    await insertPendingAgreement({
      id: agreement.agreementId,
      kind,
      userId: user.id,
      bandId: band.id,
      amountKr,
    });
    return NextResponse.json({ url: agreement.vippsConfirmationUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : (await getT()).errors.vippsStart;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
