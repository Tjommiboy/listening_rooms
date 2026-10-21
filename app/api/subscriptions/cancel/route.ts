import { NextRequest, NextResponse } from "next/server";
import { cancelFanSubscription } from "@/lib/fan";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

// Cancels the signed-in fan's own subscription: { agreementId }.
// No more charges; access stays until the paid month runs out.
export async function POST(request: NextRequest) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: t.errors.loginFirst }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    agreementId?: unknown;
  };
  if (typeof body.agreementId !== "string" || body.agreementId.length > 200)
    return NextResponse.json({ error: t.errors.noAgreement }, { status: 400 });

  try {
    const result = await cancelFanSubscription(user.id, body.agreementId);
    if (result === "not_found")
      return NextResponse.json(
        { error: t.errors.noAgreement },
        { status: 404 },
      );
    if (result === "not_active")
      return NextResponse.json(
        { error: t.errors.notCancellable },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cancel failed", body.agreementId, error);
    return NextResponse.json({ error: t.errors.cancelFailed }, { status: 502 });
  }
}
