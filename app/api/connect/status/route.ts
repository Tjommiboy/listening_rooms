import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("account");
  if (!accountId?.startsWith("acct_")) return NextResponse.json({ error: "Missing Stripe account." }, { status: 400 });
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_CONNECT !== "true") {
    return NextResponse.json({ error: "Stripe status is not enabled for this environment yet." }, { status: 403 });
  }
  try {
    const account = await getStripe().accounts.retrieve(accountId);
    return NextResponse.json({ chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled, detailsSubmitted: account.details_submitted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Stripe account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
