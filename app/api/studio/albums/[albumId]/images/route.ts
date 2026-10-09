import { NextRequest, NextResponse } from "next/server";
import { BOOKLET_LIMITS, bookletImageUrl, getOwnAlbum } from "@/lib/albums";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv, newId } from "@/lib/cf";
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

// Adds a picture to the album's booklet. Body: the raw image (max 20 MB).
// Booklet pictures live under booklet/ in the band's bucket and are only
// served to members (see /api/media/album-images).
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { albumId } = await params;
  const t = (await getT()).errors;
  if (!(await getOwnAlbum(albumId, ctx.band.id)))
    return NextResponse.json({ error: t.albumNotFound }, { status: 404 });

  const { DB } = await getEnv();
  const count = await DB.prepare(
    "SELECT COUNT(*) AS n FROM album_images WHERE album_id = ?1",
  )
    .bind(albumId)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= BOOKLET_LIMITS.images)
    return NextResponse.json({ error: t.tooManyImages }, { status: 409 });

  const data = await request.arrayBuffer();
  if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES)
    return NextResponse.json({ error: t.imageSize }, { status: 413 });
  const type = sniffImageType(data);
  if (!type) return NextResponse.json({ error: t.imageType }, { status: 415 });

  const bucket = await ensureBandBucket(ctx.band);
  const id = newId("img");
  const key = `booklet/${albumId}/${id}.${EXT[type]}`;
  await (await getBucketDriver()).put(bucket, key, data, type);
  await DB.prepare(
    `INSERT INTO album_images (id, album_id, image_key, caption, position, created_at)
     VALUES (?1, ?2, ?3, '',
             (SELECT COALESCE(MAX(position), 0) + 1 FROM album_images WHERE album_id = ?2), ?4)`,
  )
    .bind(id, albumId, key, Date.now())
    .run();
  return NextResponse.json({ id, url: bookletImageUrl(id), caption: "" });
}

// Reorders the pictures. Body: { order: [imageId, ...] }
export async function PUT(request: NextRequest, { params }: Params) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { albumId } = await params;
  if (!(await getOwnAlbum(albumId, ctx.band.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { order?: unknown };
  const order = Array.isArray(body.order)
    ? body.order.filter((x): x is string => typeof x === "string").slice(0, 100)
    : [];
  const { DB } = await getEnv();
  if (order.length)
    await DB.batch(
      order.map((imageId, position) =>
        DB.prepare(
          "UPDATE album_images SET position = ?3 WHERE id = ?1 AND album_id = ?2",
        ).bind(imageId, albumId, position),
      ),
    );
  return NextResponse.json({ ok: true });
}
