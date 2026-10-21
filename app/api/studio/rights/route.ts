import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { confirmRights } from "@/lib/rights";
import { requireBandOwner } from "@/lib/storage";

// The band owner confirms the upload declaration: { accept: true }.
export async function POST(request: NextRequest) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const body = (await request.json().catch(() => ({}))) as { accept?: unknown };
  if (body.accept !== true)
    return NextResponse.json(
      { error: (await getT()).errors.rightsRequired },
      { status: 400 },
    );
  await confirmRights(ctx.band.id, ctx.user.id);
  return NextResponse.json({ ok: true });
}
