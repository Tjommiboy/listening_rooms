import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { requireBandOwner } from "@/lib/storage";

// Removes a track from the room and from the band's bucket.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { trackId } = await params;
  const { DB } = await getEnv();
  const track = await DB.prepare(
    "SELECT r2_key FROM tracks WHERE id = ?1 AND band_id = ?2",
  )
    .bind(trackId, ctx.band.id)
    .first<{ r2_key: string }>();
  if (!track)
    return NextResponse.json(
      { error: (await getT()).errors.trackNotFound },
      { status: 404 },
    );
  await (await getBucketDriver()).delete(ctx.band.bucket_name!, track.r2_key);
  await DB.prepare("DELETE FROM tracks WHERE id = ?1").bind(trackId).run();
  return NextResponse.json({ ok: true });
}
