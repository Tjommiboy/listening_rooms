import { NextRequest, NextResponse } from "next/server";
import {
  verifyStripeSignature,
  type CheckoutSession,
  type StripeEvent,
} from "@/lib/stripe";
import {
  claimStripeEvent,
  handleAccountUpdated,
  handleInvoicePaid,
  handleSubscriptionChange,
  releaseStripeEvent,
  syncCheckoutSession,
} from "@/lib/stripe-sync";

// Stripe webhooks. Register two endpoints with this URL in the Stripe
// dashboard: one for your own account and one for connected accounts
// ("Events on Connected accounts"), each with its own signing secret.
// Events: checkout.session.completed, invoice.paid,
// customer.subscription.updated, customer.subscription.deleted, account.updated
export async function POST(request: NextRequest) {
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter((s): s is string => Boolean(s));
  if (secrets.length === 0)
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 503 },
    );

  const body = await request.text();
  const valid = await verifyStripeSignature(
    body,
    request.headers.get("stripe-signature"),
    secrets,
  );
  if (!valid)
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });

  const event = JSON.parse(body) as StripeEvent;
  if (!(await claimStripeEvent(event.id, event.type)))
    return NextResponse.json({ received: true, duplicate: true });

  const object = event.data.object;
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await syncCheckoutSession(
          object as unknown as CheckoutSession,
          event.account,
        );
        break;
      case "invoice.paid":
        await handleInvoicePaid(object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(
          object as {
            id: string;
            status: string;
            cancel_at_period_end?: boolean;
          },
        );
        break;
      case "account.updated":
        await handleAccountUpdated(
          object as { id: string; charges_enabled: boolean },
        );
        break;
    }
  } catch (error) {
    // Let Stripe retry later.
    await releaseStripeEvent(event.id);
    console.error("Stripe webhook failed", event.type, error);
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
