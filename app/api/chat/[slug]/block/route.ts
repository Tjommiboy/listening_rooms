import { NextRequest, NextResponse } from "next/server";
import { getBandBySlug } from "@/lib/access";
import { getChatViewer, setChatBlocked } from "@/lib/chat";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

// The band's owner blocks (or unblocks) a fan from writing: { userId, blocked }.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: t.errors.loginFirst }, { status: 401 });
  const band = await getBandBySlug((await params).slug);
  if (!band)
    return NextResponse.json({ error: t.errors.roomNotFound }, { status: 404 });
  const viewer = await getChatViewer(user, band);
  if (viewer?.role !== "owner")
    return NextResponse.json({ error: t.errors.chatNoAccess }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    userId?: unknown;
    blocked?: unknown;
  };
  if (typeof body.userId !== "string" || typeof body.blocked !== "boolean")
    return NextResponse.json(
      { error: t.errors.chatMessageNotFound },
      { status: 400 },
    );
  const done = await setChatBlocked({
    band,
    fanId: body.userId.slice(0, 100),
    blocked: body.blocked,
    byUserId: user.id,
  });
  if (!done)
    return NextResponse.json(
      { error: t.errors.chatMessageNotFound },
      { status: 404 },
    );
  return NextResponse.json({ ok: true });
}
