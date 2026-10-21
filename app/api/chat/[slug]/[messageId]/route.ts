import { NextRequest, NextResponse } from "next/server";
import { getBandBySlug } from "@/lib/access";
import { deleteChatMessage, getChatViewer } from "@/lib/chat";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

// Deletes a message: its author, the band's owner or a platform admin.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; messageId: string }> },
) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: t.errors.loginFirst }, { status: 401 });
  const { slug, messageId } = await params;
  const band = await getBandBySlug(slug);
  if (!band)
    return NextResponse.json({ error: t.errors.roomNotFound }, { status: 404 });
  const viewer = await getChatViewer(user, band);
  if (!viewer)
    return NextResponse.json({ error: t.errors.chatNoAccess }, { status: 403 });
  if (
    !(await deleteChatMessage({
      band,
      viewer,
      messageId: messageId.slice(0, 100),
    }))
  )
    return NextResponse.json(
      { error: t.errors.chatMessageNotFound },
      { status: 404 },
    );
  return NextResponse.json({ ok: true });
}
