import { NextRequest, NextResponse } from "next/server";
import { getBandByOwner } from "@/lib/access";
import { getEnv } from "@/lib/cf";
import { getT } from "@/lib/i18n/server";
import { appOrigin } from "@/lib/redirect";
import { getCurrentUser } from "@/lib/session";
import { createBandAccount, createOnboardingLink } from "@/lib/stripe";

// A band connects its own Stripe account (Express) to take card payments
// from fans abroad. Returns the Stripe onboarding URL.
export async function POST(request: NextRequest) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: t.errors.loginFirst }, { status: 401 });
  const band = await getBandByOwner(user.id);
  if (!band)
    return NextResponse.json({ error: t.errors.noBand }, { status: 404 });

  try {
    let accountId = band.stripe_account_id;
    if (!accountId) {
      accountId = (
        await createBandAccount({ bandId: band.id, email: user.email })
      ).id;
      const { DB } = await getEnv();
      await DB.prepare(`UPDATE bands SET stripe_account_id = ?2 WHERE id = ?1`)
        .bind(band.id, accountId)
        .run();
    }
    const origin = appOrigin(request.nextUrl.origin);
    const link = await createOnboardingLink({
      accountId,
      refreshUrl: `${origin}/studio?stripe=oppsett`,
      returnUrl: `${origin}/studio?stripe=oppsett`,
    });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("Stripe Connect failed", error);
    return NextResponse.json({ error: t.errors.stripeStart }, { status: 500 });
  }
}
