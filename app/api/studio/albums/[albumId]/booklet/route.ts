import { NextRequest, NextResponse } from "next/server";
import { BOOKLET_LIMITS, getOwnAlbum, parseCredits } from "@/lib/albums";
import { getEnv } from "@/lib/cf";
import { getT } from "@/lib/i18n/server";
import { requireBandOwner } from "@/lib/storage";

// Saves an album's booklet.
// Body: { notes, credits: [{role, name}],
//         tracks: { [trackId]: { credits: [{role, name}], notes } } }
// Everything is stored as plain text and shown as plain text.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { albumId } = await params;
  if (!(await getOwnAlbum(albumId, ctx.band.id)))
    return NextResponse.json(
      { error: (await getT()).errors.albumNotFound },
      { status: 404 },
    );

  const body = (await request.json().catch(() => ({}))) as {
    notes?: unknown;
    credits?: unknown;
    tracks?: unknown;
  };
  const notes =
    typeof body.notes === "string"
      ? body.notes.replace(/\r\n/g, "\n").trim().slice(0, BOOKLET_LIMITS.notes)
      : "";
  const credits = parseCredits(body.credits, BOOKLET_LIMITS.credits);

  const { DB } = await getEnv();
  const statements = [
    DB.prepare(
      "UPDATE albums SET booklet = ?2, updated_at = ?3 WHERE id = ?1",
    ).bind(albumId, JSON.stringify({ notes, credits }), Date.now()),
  ];
  // Per-song parts: only for songs that are actually on this album
  // (the WHERE clause ignores anything else).
  if (body.tracks && typeof body.tracks === "object") {
    for (const [trackId, value] of Object.entries(
      body.tracks as Record<string, unknown>,
    ).slice(0, 200)) {
      const v = (value ?? {}) as { credits?: unknown; notes?: unknown };
      const trackNotes =
        typeof v.notes === "string"
          ? v.notes
              .replace(/\r\n/g, "\n")
              .trim()
              .slice(0, BOOKLET_LIMITS.trackNotes)
          : "";
      statements.push(
        DB.prepare(
          "UPDATE album_tracks SET credits = ?3, notes = ?4 WHERE album_id = ?1 AND track_id = ?2",
        ).bind(
          albumId,
          trackId,
          JSON.stringify(parseCredits(v.credits, BOOKLET_LIMITS.trackCredits)),
          trackNotes,
        ),
      );
    }
  }
  await DB.batch(statements);
  return NextResponse.json({ ok: true, notes, credits });
}
