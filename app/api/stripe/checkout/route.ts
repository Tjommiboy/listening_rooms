import { NextRequest, NextResponse } from "next/server";
import { getBandByOwner, getBandBySlug, hasAccess } from "@/lib/access";
import type { AgreementKind } from "@/lib/agreements";
import { getLocale, getT } from "@/lib/i18n/server";
import { ARTIST_PLAN_PRICE_KR, PLATFORM_FEE_PERCENT } from "@/lib/pricing";
import { appOrigin } from "@/lib/redirect";
import { getCurrentUser } from "@/lib/session";
import { createSubscriptionCheckout } from "@/lib/stripe";
import type { CheckoutMeta } from "@/lib/stripe-sync";

// Starts a monthly card subscription in Stripe Checkout:
//   { slug }         → fan membership, on the band's own Stripe account
//   { plan: "band" } → band plan, on Listening Rooms' account
export async function POST(request: NextRequest) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: t.errors.loginFirst }, { status: 401 });

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
    return NextResponse.json({ error: t.errors.roomNotFound }, { status: 404 });
  if (kind === "fan" && (await hasAccess(user.id, band)))
    return NextResponse.json(
      { error: t.errors.alreadyAccess },
      { status: 409 },
    );
  if (
    kind === "fan" &&
    (!band.stripe_account_id || !band.stripe_charges_enabled)
  )
    return NextResponse.json(
      { error: t.errors.stripeNotReady },
      { status: 409 },
    );

  const origin = appOrigin(request.nextUrl.origin);
  const back =
    kind === "fan" ? `${origin}/room/${band.slug}` : `${origin}/studio`;
  const amountKr = kind === "fan" ? band.member_price_kr : ARTIST_PLAN_PRICE_KR;
  const metadata: CheckoutMeta = {
    user_id: user.id,
    band_id: band.id,
    kind,
    amount_ore: String(amountKr * 100),
  };
  try {
    const session = await createSubscriptionCheckout({
      account:
        kind === "fan" ? (band.stripe_account_id ?? undefined) : undefined,
      feePercent: kind === "fan" ? PLATFORM_FEE_PERCENT : undefined,
      amountOre: amountKr * 100,
      productName:
        kind === "fan"
          ? t.stripe.fanProduct(band.name)
          : t.stripe.planProduct(band.name),
      customerEmail: user.email,
      successUrl: `${back}?stripe=retur&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: back,
      metadata,
      locale: await getLocale(),
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout failed", error);
    return NextResponse.json({ error: t.errors.stripeStart }, { status: 500 });
  }
}
