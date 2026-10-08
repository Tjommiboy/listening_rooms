import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getBandBySlug } from "@/lib/access";
import { insertPendingAgreement, markPaid } from "@/lib/agreements";
import { newId } from "@/lib/cf";
import { demoMembershipEnabled } from "@/lib/demo";
import { getCurrentUser } from "@/lib/session";

// Local testing only: become a paying member of a room without Vipps.
export async function POST(request: NextRequest) {
  if (!demoMembershipEnabled())
    return NextResponse.json(
      { error: (await getT()).errors.notAvailable },
      { status: 404 },
    );
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: (await getT()).errors.loginFirst },
      { status: 401 },
    );
  const { slug } = (await request.json().catch(() => ({}))) as {
    slug?: string;
  };
  const band = await getBandBySlug(slug ?? "");
  if (!band)
    return NextResponse.json(
      { error: (await getT()).errors.roomNotFound },
      { status: 404 },
    );
  const id = newId("demo");
  await insertPendingAgreement({
    id,
    kind: "fan",
    userId: user.id,
    bandId: band.id,
    amountKr: band.member_price_kr,
  });
  await markPaid(id, Date.now());
  return NextResponse.json({ ok: true });
}
