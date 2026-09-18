import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  // This endpoint is intentionally local-development only. In production, get the
  // artist ID from an authenticated session and store stripeAccountId in the database.
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_CONNECT !== "true") {
    return NextResponse.json({ error: "Stripe onboarding is not enabled for this environment yet." }, { status: 403 });
  }

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.create({
      type: "express",
      country: "NO",
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { listening_rooms_artist: "demo-artist" },
    });
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/studio?connect=refresh`,
      return_url: `${origin}/studio?connect=return&stripe_account=${account.id}`,
      type: "account_onboarding",
    });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Stripe onboarding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
