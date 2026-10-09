import { NextRequest, NextResponse } from "next/server";
import { setAlbumTracks } from "@/lib/albums";
import { getEnv, newId } from "@/lib/cf";
import { getT } from "@/lib/i18n/server";
import { requireBandOwner } from "@/lib/storage";

// Creates an album. Body: { title, description?, trackIds? }
export async function POST(request: NextRequest) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const body = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    description?: unknown;
    trackIds?: unknown;
  };
  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title)
    return NextResponse.json(
      { error: (await getT()).errors.albumTitleRequired },
      { status: 400 },
    );
  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 2000)
      : "";

  const { DB } = await getEnv();
  const id = newId("alb");
  const now = Date.now();
  await DB.prepare(
    `INSERT INTO albums (id, band_id, title, description, position, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4,
             (SELECT COALESCE(MAX(position), 0) + 1 FROM albums WHERE band_id = ?2),
             ?5, ?5)`,
  )
    .bind(id, ctx.band.id, title, description, now)
    .run();
  const trackIds = Array.isArray(body.trackIds)
    ? await setAlbumTracks(
        id,
        ctx.band.id,
        body.trackIds.filter((x): x is string => typeof x === "string"),
      )
    : [];
  return NextResponse.json({
    id,
    title,
    description,
    coverUrl: null,
    trackIds,
  });
}
