import { NextRequest, NextResponse } from "next/server";
import { getBandBySlug } from "@/lib/access";
import { getChatViewer, postChatMessage } from "@/lib/chat";
import { parseChatMessage } from "@/lib/chat-rules";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

// Writes a message in a room's chat: { body, parentId? }.
// Only the band and its paying fans (and not blocked ones) may write.
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
  if (!viewer || viewer.role === "admin")
    return NextResponse.json({ error: t.errors.chatNoAccess }, { status: 403 });
  if (viewer.blocked)
    return NextResponse.json({ error: t.errors.chatBlocked }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    body?: unknown;
    parentId?: unknown;
  };
  const parsed = parseChatMessage(body.body);
  if (!parsed.ok)
    return NextResponse.json({ error: t.errors.chatInvalid }, { status: 400 });
  const parentId =
    typeof body.parentId === "string" && body.parentId
      ? body.parentId.slice(0, 100)
      : null;

  const result = await postChatMessage({
    band,
    userId: user.id,
    text: parsed.text,
    parentId,
  });
  if (!result.ok)
    return result.error === "too_fast"
      ? NextResponse.json({ error: t.errors.chatTooFast }, { status: 429 })
      : NextResponse.json({ error: t.errors.chatParentGone }, { status: 404 });
  return NextResponse.json({ ok: true });
}
