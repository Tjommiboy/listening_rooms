import { NextRequest } from "next/server";
import { getBucketDriver, RangeNotSatisfiable } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { hasAccess, type Band } from "@/lib/access";
import { getCurrentUser } from "@/lib/session";

// Every play goes through here. Each band's bucket is private; this route
// checks that the signed-in user may hear the band before sending any bytes,
// then reads from that band's bucket. Range requests are passed on so seeking
// in the player works.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  const { DB } = await getEnv();

  const track = await DB.prepare(
    `SELECT t.r2_key, t.content_type,
            b.id, b.slug, b.name, b.owner_id, b.member_price_kr, b.bucket_name
       FROM tracks t JOIN bands b ON b.id = t.band_id
      WHERE t.id = ?1`,
  )
    .bind(trackId)
    .first<Band & { r2_key: string; content_type: string }>();
  if (!track?.bucket_name) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!(await hasAccess(user?.id, track)))
    return new Response("Members only", {
      status: user ? 403 : 401,
      headers: { "Cache-Control": "no-store" },
    });

  let object;
  try {
    object = await (
      await getBucketDriver()
    ).get(track.bucket_name, track.r2_key, request.headers.get("range"));
  } catch (error) {
    if (error instanceof RangeNotSatisfiable)
      return new Response("Range not satisfiable", { status: 416 });
    throw error;
  }
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": track.content_type,
    "Content-Length": String(object.contentLength),
    "Accept-Ranges": "bytes",
    // Private: never stored by shared caches, so access is checked each time.
    "Cache-Control": "private, no-store",
  });
  if (object.etag) headers.set("ETag", object.etag);
  if (object.contentRange) headers.set("Content-Range", object.contentRange);
  return new Response(object.body, { status: object.status, headers });
}
