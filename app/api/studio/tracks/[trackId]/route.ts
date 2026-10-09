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
    "SELECT r2_key FROM tracks WHERE id = ?1 AND band_id = ?2 AND deleted_at IS NULL",
  )
    .bind(trackId, ctx.band.id)
    .first<{ r2_key: string }>();
  if (!track)
    return NextResponse.json(
      { error: (await getT()).errors.trackNotFound },
      { status: 404 },
    );
  await (await getBucketDriver()).delete(ctx.band.bucket_name!, track.r2_key);
  // Keep the row (marked deleted) so earlier TONO reports stay complete.
  await DB.batch([
    DB.prepare("UPDATE tracks SET deleted_at = ?2 WHERE id = ?1").bind(
      trackId,
      Date.now(),
    ),
    // Take it off any albums too.
    DB.prepare("DELETE FROM album_tracks WHERE track_id = ?1").bind(trackId),
  ]);
  return NextResponse.json({ ok: true });
}

const ISWC = /^T-?(\d{3})\.?(\d{3})\.?(\d{3})-?(\d)$/i;
const ISRC = /^([A-Z]{2})-?([A-Z0-9]{3})-?(\d{2})-?(\d{5})$/i;
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

// Saves who wrote a track (for TONO reporting).
// Body: { rights: "own"|"tono"|"cover"|null, writers, originalTitle, iswc, isrc }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { trackId } = await params;
  const t = (await getT()).errors;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const rights =
    body.rights === "own" || body.rights === "tono" || body.rights === "cover"
      ? body.rights
      : null;
  const writers = text(body.writers, 300);
  const originalTitle = text(body.originalTitle, 200);
  const iswcRaw = text(body.iswc, 20);
  const isrcRaw = text(body.isrc, 20);

  const iswcMatch = iswcRaw ? ISWC.exec(iswcRaw) : null;
  if (iswcRaw && !iswcMatch)
    return NextResponse.json({ error: t.iswcInvalid }, { status: 400 });
  const isrcMatch = isrcRaw ? ISRC.exec(isrcRaw) : null;
  if (isrcRaw && !isrcMatch)
    return NextResponse.json({ error: t.isrcInvalid }, { status: 400 });
  if ((rights === "tono" || rights === "cover") && !writers)
    return NextResponse.json({ error: t.writersRequired }, { status: 400 });

  // Store codes in their standard written form.
  const iswc = iswcMatch
    ? `T-${iswcMatch[1]}.${iswcMatch[2]}.${iswcMatch[3]}-${iswcMatch[4]}`
    : null;
  const isrc = isrcMatch
    ? `${isrcMatch[1]}${isrcMatch[2]}${isrcMatch[3]}${isrcMatch[4]}`.toUpperCase()
    : null;

  const { DB } = await getEnv();
  const result = await DB.prepare(
    `UPDATE tracks
        SET rights = ?3, writers = ?4, original_title = ?5, iswc = ?6, isrc = ?7
      WHERE id = ?1 AND band_id = ?2 AND deleted_at IS NULL`,
  )
    .bind(trackId, ctx.band.id, rights, writers, originalTitle, iswc, isrc)
    .run();
  if (!result.meta.changes)
    return NextResponse.json({ error: t.trackNotFound }, { status: 404 });
  return NextResponse.json({
    rights,
    writers,
    original_title: originalTitle,
    iswc,
    isrc,
  });
}

// Renames a track. Body: { title }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { trackId } = await params;
  const t = (await getT()).errors;
  const body = (await request.json().catch(() => ({}))) as { title?: unknown };
  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title)
    return NextResponse.json({ error: t.trackTitleRequired }, { status: 400 });
  const { DB } = await getEnv();
  const result = await DB.prepare(
    "UPDATE tracks SET title = ?3 WHERE id = ?1 AND band_id = ?2 AND deleted_at IS NULL",
  )
    .bind(trackId, ctx.band.id, title)
    .run();
  if (!result.meta.changes)
    return NextResponse.json({ error: t.trackNotFound }, { status: 404 });
  return NextResponse.json({ title });
}
