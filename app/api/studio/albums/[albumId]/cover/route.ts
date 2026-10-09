import { NextRequest, NextResponse } from "next/server";
import { albumCoverUrl, getOwnAlbum } from "@/lib/albums";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { getT } from "@/lib/i18n/server";
import { MAX_IMAGE_BYTES, sniffImageType } from "@/lib/room-theme";
import { ensureBandBucket, requireBandOwner } from "@/lib/storage";

type Params = { params: Promise<{ albumId: string }> };
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

// Album cover (raw image body, max 20 MB), stored in the band's own bucket.
export async function PUT(request: NextRequest, { params }: Params) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { albumId } = await params;
  const t = (await getT()).errors;
  const album = await getOwnAlbum(albumId, ctx.band.id);
  if (!album)
    return NextResponse.json({ error: t.albumNotFound }, { status: 404 });

  const data = await request.arrayBuffer();
  if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES)
    return NextResponse.json({ error: t.imageSize }, { status: 413 });
  const type = sniffImageType(data);
  if (!type) return NextResponse.json({ error: t.imageType }, { status: 415 });

  const bucket = await ensureBandBucket(ctx.band);
  const key = `public/album-${albumId}-${Date.now()}.${EXT[type]}`;
  const driver = await getBucketDriver();
  await driver.put(bucket, key, data, type);
  const now = Date.now();
  const { DB } = await getEnv();
  await DB.prepare(
    "UPDATE albums SET cover_key = ?2, updated_at = ?3 WHERE id = ?1",
  )
    .bind(albumId, key, now)
    .run();
  if (album.cover_key)
    await driver.delete(bucket, album.cover_key).catch(() => {});
  return NextResponse.json({ url: albumCoverUrl(albumId, now) });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { albumId } = await params;
  const album = await getOwnAlbum(albumId, ctx.band.id);
  if (!album) return NextResponse.json({ ok: true });
  const { DB } = await getEnv();
  await DB.prepare(
    "UPDATE albums SET cover_key = NULL, updated_at = ?2 WHERE id = ?1",
  )
    .bind(albumId, Date.now())
    .run();
  if (album.cover_key && ctx.band.bucket_name)
    await (
      await getBucketDriver()
    )
      .delete(ctx.band.bucket_name, album.cover_key)
      .catch(() => {});
  return NextResponse.json({ ok: true });
}
