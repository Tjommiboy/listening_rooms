import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { requireBandOwner } from "@/lib/storage";
import { reorderTracks } from "@/lib/tracks";

// Saves the order of the band's songs. Body: { trackIds: string[] }
// Songs left out of the list keep their relative order after the listed ones.
export async function PUT(request: NextRequest) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const body = (await request.json().catch(() => null)) as {
    trackIds?: unknown;
  } | null;
  if (
    !body ||
    !Array.isArray(body.trackIds) ||
    !body.trackIds.every((id) => typeof id === "string")
  )
    return NextResponse.json(
      { error: (await getT()).errors.trackNotFound },
      { status: 400 },
    );
  const trackIds = await reorderTracks(ctx.band.id, body.trackIds as string[]);
  return NextResponse.json({ trackIds });
}
