import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getT } from "@/lib/i18n/server";
import {
  resolveReport,
  setBandDisabled,
  setTrackDisabled,
} from "@/lib/moderation";
import { getCurrentUser } from "@/lib/session";

// Platform admins only: switch songs and bands off/on, close reports.
//   { action, id, reason?, note?, reportId? }
export async function POST(request: NextRequest) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!isAdmin(user) || !user)
    return NextResponse.json({ error: t.errors.notAvailable }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    id?: unknown;
    reason?: unknown;
    note?: unknown;
    reportId?: unknown;
  };
  if (typeof body.id !== "string" || !body.id || body.id.length > 100)
    return NextResponse.json({ error: t.errors.notAvailable }, { status: 400 });
  const reportId =
    typeof body.reportId === "string" ? body.reportId.slice(0, 100) : null;

  let done = false;
  switch (body.action) {
    case "disable_track":
    case "enable_track":
      done = await setTrackDisabled({
        adminId: user.id,
        trackId: body.id,
        disabled: body.action === "disable_track",
        reason: body.reason,
        reportId,
      });
      break;
    case "disable_band":
    case "enable_band":
      done = await setBandDisabled({
        adminId: user.id,
        bandId: body.id,
        disabled: body.action === "disable_band",
        reason: body.reason,
        reportId,
      });
      break;
    case "resolve_report":
      done = await resolveReport({
        adminId: user.id,
        reportId: body.id,
        note: body.note,
      });
      break;
    default:
      return NextResponse.json(
        { error: t.errors.notAvailable },
        { status: 400 },
      );
  }
  if (!done)
    return NextResponse.json({ error: t.errors.notAvailable }, { status: 404 });
  return NextResponse.json({ ok: true });
}
