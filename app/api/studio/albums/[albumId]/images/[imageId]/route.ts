import { NextRequest, NextResponse } from "next/server";
import { getOwnAlbum } from "@/lib/albums";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { requireBandOwner } from "@/lib/storage";

type Params = { params: Promise<{ albumId: string; imageId: string }> };

// Changes a booklet picture's caption. Body: { caption }
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { albumId, imageId } = await params;
  if (!(await getOwnAlbum(albumId, ctx.band.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as {
    caption?: unknown;
  };
  const caption =
    typeof body.caption === "string" ? body.caption.trim().slice(0, 300) : "";
  const { DB } = await getEnv();
  await DB.prepare(
    "UPDATE album_images SET caption = ?3 WHERE id = ?1 AND album_id = ?2",
  )
    .bind(imageId, albumId, caption)
    .run();
  return NextResponse.json({ caption });
}

// Removes a picture from the booklet and from storage.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { albumId, imageId } = await params;
  if (!(await getOwnAlbum(albumId, ctx.band.id)))
    return NextResponse.json({ ok: true });
  const { DB } = await getEnv();
  const image = await DB.prepare(
    "SELECT image_key FROM album_images WHERE id = ?1 AND album_id = ?2",
  )
    .bind(imageId, albumId)
    .first<{ image_key: string }>();
  if (!image) return NextResponse.json({ ok: true });
  await DB.prepare("DELETE FROM album_images WHERE id = ?1")
    .bind(imageId)
    .run();
  if (ctx.band.bucket_name)
    await (
      await getBucketDriver()
    )
      .delete(ctx.band.bucket_name, image.image_key)
      .catch(() => {});
  return NextResponse.json({ ok: true });
}
