import { NextRequest, NextResponse } from "next/server";
import { claimEvent, markPaid, setAgreementStatus } from "@/lib/agreements";
import { verifyWebhook } from "@/lib/vipps";

// Receives Recurring events from the Vipps Webhooks API and keeps the
// agreements table (and so who has access) up to date.
type RecurringEvent = {
  eventType?: string;
  agreementId?: string;
  chargeId?: string;
  occurred?: string;
};

export async function POST(request: NextRequest) {
  const secret = process.env.VIPPS_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 503 },
    );

  const body = await request.text();
  const valid = verifyWebhook({
    body,
    pathAndQuery: request.nextUrl.pathname + request.nextUrl.search,
    host: request.headers.get("host") ?? "",
    date: request.headers.get("x-ms-date"),
    contentSha256: request.headers.get("x-ms-content-sha256"),
    authorization: request.headers.get("authorization"),
    secret,
  });
  if (!valid)
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  const event = JSON.parse(body) as RecurringEvent;
  const { eventType, agreementId } = event;
  if (!eventType || !agreementId) return NextResponse.json({ received: true });

  const parsed = event.occurred ? Date.parse(event.occurred) : NaN;
  const occurredAt = Number.isFinite(parsed) ? parsed : Date.now();
  const isNew = await claimEvent({
    id: `${eventType}:${event.chargeId ?? agreementId}`,
    agreementId,
    eventType,
    occurredAt,
  });
  if (!isNew) return NextResponse.json({ received: true, duplicate: true });

  switch (eventType) {
    case "recurring.charge-captured.v1":
      await markPaid(agreementId, occurredAt);
      break;
    case "recurring.agreement-activated.v1":
      await setAgreementStatus(agreementId, "ACTIVE");
      break;
    case "recurring.agreement-stopped.v1":
      // Access continues until paid_until; no refund of the current month.
      await setAgreementStatus(agreementId, "STOPPED");
      break;
    case "recurring.agreement-expired.v1":
    case "recurring.agreement-rejected.v1":
      await setAgreementStatus(agreementId, "EXPIRED");
      break;
    case "recurring.charge-failed.v1":
    case "recurring.charge-creation-failed.v1":
      // Nothing to change: access lapses by itself when paid_until (+ grace)
      // passes. Log so failed renewals can be followed up.
      console.warn("Vipps charge failed", agreementId, event.chargeId);
      break;
  }
  return NextResponse.json({ received: true });
}
