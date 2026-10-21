import { NextRequest, NextResponse } from "next/server";
import { getBandByOwner, getBandBySlug } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";
import { syncCheckoutSessionById } from "@/lib/stripe-sync";

// Called when the user returns from Stripe Checkout, so access opens right
// away even if the webhook is slow (or can't reach localhost).
export async function GET(request: NextRequest) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: t.errors.loginFirst }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const sessionId = params.get("session_id") ?? "";
  const isPlan = params.get("plan") === "band";
  const band = isPlan
    ? await getBandByOwner(user.id)
    : await getBandBySlug(params.get("slug") ?? "");
  if (!band || !sessionId.startsWith("cs_"))
    return NextResponse.json({ error: t.errors.roomNotFound }, { status: 404 });
  try {
    const account = isPlan ? undefined : (band.stripe_account_id ?? undefined);
    const subscription = await syncCheckoutSessionById(sessionId, account);
    return NextResponse.json({ status: subscription ? "ACTIVE" : "PENDING" });
  } catch (error) {
    console.error("Stripe status failed", error);
    return NextResponse.json({ error: t.errors.stripeStart }, { status: 500 });
  }
}
