import { NextRequest, NextResponse } from "next/server";
import { fakeVippsResult } from "@/lib/payout";
import { requireBandOwner } from "@/lib/storage";
import { vippsFake } from "@/lib/vipps";

// Local testing only (VIPPS_FAKE=true): the stand-in for the Vipps business
// portal posts here to approve or reject the band's application.
export async function POST(request: NextRequest) {
  if (!vippsFake()) return new NextResponse(null, { status: 404 });
  const ctx = await requireBandOwner({ readOnly: true });
  if (!ctx.ok) return ctx.response;
  const form = await request.formData();
  const order = form.get("order");
  if (typeof order === "string")
    await fakeVippsResult(ctx.band.id, order, form.get("result") === "approve");
  return NextResponse.redirect(new URL("/studio/betaling", request.url), 303);
}
