import { NextRequest, NextResponse } from "next/server";
import { hasAccess, type Band } from "@/lib/access";
import { getEnv } from "@/lib/cf";
import { recordPlay } from "@/lib/plays";
import { getCurrentUser } from "@/lib/session";

const PLAY_ID = /^[0-9a-f-]{16,64}$/i;

// The player reports listening progress here: at start, every 15 seconds,
// and when it pauses or the page closes (navigator.sendBeacon).
// Body: { playId, trackId, seconds, duration? }
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    playId?: unknown;
    trackId?: unknown;
    seconds?: unknown;
    duration?: unknown;
  };
  const playId = typeof body.playId === "string" ? body.playId : "";
  const trackId = typeof body.trackId === "string" ? body.trackId : "";
  const seconds = Number(body.seconds);
  if (!PLAY_ID.test(playId) || !trackId || !Number.isFinite(seconds))
    return new NextResponse(null, { status: 400 });

  const { DB } = await getEnv();
  const track = await DB.prepare(
    `SELECT t.duration_sec,
            b.id, b.slug, b.name, b.owner_id, b.member_price_kr, b.bucket_name
       FROM tracks t JOIN bands b ON b.id = t.band_id
      WHERE t.id = ?1 AND t.deleted_at IS NULL`,
  )
    .bind(trackId)
    .first<Band & { duration_sec: number | null }>();
  if (!track) return new NextResponse(null, { status: 404 });
  // Only plays the user was actually allowed to hear are recorded.
  if (!(await hasAccess(user.id, track)))
    return new NextResponse(null, { status: 403 });

  // Learn the track length from the player the first time we see it.
  let durationSec = track.duration_sec;
  const reported = Math.round(Number(body.duration));
  if (
    !durationSec &&
    Number.isFinite(reported) &&
    reported > 0 &&
    reported < 4 * 3600
  ) {
    durationSec = reported;
    await DB.prepare(
      "UPDATE tracks SET duration_sec = ?2 WHERE id = ?1 AND duration_sec IS NULL",
    )
      .bind(trackId, reported)
      .run();
  }

  await recordPlay({
    playId,
    userId: user.id,
    trackId,
    bandId: track.id,
    isOwner: track.owner_id === user.id,
    seconds,
    durationSec,
  });
  return new NextResponse(null, { status: 204 });
}
