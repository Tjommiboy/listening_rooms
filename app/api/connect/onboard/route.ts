import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

const DEMO_ARTIST = "demo-artist";

export async function POST(request: NextRequest) {
  // This endpoint is intentionally local-development only. In production, get the
  // artist ID from an authenticated session and store stripeAccountId in the database.
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEMO_CONNECT !== "true"
  ) {
    return NextResponse.json(
      { error: "Stripe onboarding is not enabled for this environment yet." },
      { status: 403 },
    );
  }

  try {
    const stripe = getStripe();
    const body = (await request.json().catch(() => ({}))) as {
      account?: unknown;
    };

    // Resume onboarding for an account this demo already created, rather than
    // creating a new connected account on every click.
    let accountId: string | undefined;
    if (typeof body.account === "string" && body.account.startsWith("acct_")) {
      const existing = await stripe.accounts
        .retrieve(body.account)
        .catch(() => null);
      if (existing?.metadata?.listening_rooms_artist === DEMO_ARTIST)
        accountId = existing.id;
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "NO",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { listening_rooms_artist: DEMO_ARTIST },
      });
      accountId = account.id;
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/studio?connect=refresh&stripe_account=${accountId}`,
      return_url: `${origin}/studio?connect=return&stripe_account=${accountId}`,
      type: "account_onboarding",
    });
    return NextResponse.json({ url: link.url, account: accountId });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create Stripe onboarding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
