import { NextRequest, NextResponse } from "next/server";
import { getOwnAlbum, setAlbumTracks } from "@/lib/albums";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { getT } from "@/lib/i18n/server";
import { requireBandOwner } from "@/lib/storage";

type Params = { params: Promise<{ albumId: string }> };

// Updates an album. Body: { title?, description?, trackIds? } — trackIds
// replaces the whole song list, in the given order.
export async function PUT(request: NextRequest, { params }: Params) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { albumId } = await params;
  const t = (await getT()).errors;
  if (!(await getOwnAlbum(albumId, ctx.band.id)))
    return NextResponse.json({ error: t.albumNotFound }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    description?: unknown;
    trackIds?: unknown;
  };
  const { DB } = await getEnv();
  if (body.title !== undefined) {
    const title =
      typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    if (!title)
      return NextResponse.json(
        { error: t.albumTitleRequired },
        { status: 400 },
      );
    await DB.prepare(
      "UPDATE albums SET title = ?2, updated_at = ?3 WHERE id = ?1",
    )
      .bind(albumId, title, Date.now())
      .run();
  }
  if (body.description !== undefined) {
    const description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, 2000)
        : "";
    await DB.prepare(
      "UPDATE albums SET description = ?2, updated_at = ?3 WHERE id = ?1",
    )
      .bind(albumId, description, Date.now())
      .run();
  }
  let trackIds: string[] | undefined;
  if (Array.isArray(body.trackIds))
    trackIds = await setAlbumTracks(
      albumId,
      ctx.band.id,
      body.trackIds.filter((x): x is string => typeof x === "string"),
    );
  return NextResponse.json({ ok: true, trackIds });
}

// Deletes an album with its cover and booklet pictures. The songs stay in
// the band's library.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { albumId } = await params;
  const album = await getOwnAlbum(albumId, ctx.band.id);
  if (!album) return NextResponse.json({ ok: true });
  const { DB } = await getEnv();
  const { results: images } = await DB.prepare(
    "SELECT image_key FROM album_images WHERE album_id = ?1",
  )
    .bind(albumId)
    .all<{ image_key: string }>();
  await DB.batch([
    DB.prepare("DELETE FROM album_images WHERE album_id = ?1").bind(albumId),
    DB.prepare("DELETE FROM album_tracks WHERE album_id = ?1").bind(albumId),
    DB.prepare("DELETE FROM albums WHERE id = ?1").bind(albumId),
  ]);
  // Remove the cover and booklet pictures from the band's bucket.
  if (ctx.band.bucket_name) {
    const driver = await getBucketDriver();
    const keys = [album.cover_key, ...images.map((i) => i.image_key)];
    for (const key of keys)
      if (key) await driver.delete(ctx.band.bucket_name, key).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
