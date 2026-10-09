import { NextRequest } from "next/server";
import { hasAccess, type Band } from "@/lib/access";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { getCurrentUser } from "@/lib/session";

// Booklet pictures are part of what members pay for, so (unlike album
// covers) they are only served to members and the band itself.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await params;
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT i.image_key, b.id, b.slug, b.name, b.owner_id, b.member_price_kr, b.bucket_name
       FROM album_images i
       JOIN albums a ON a.id = i.album_id
       JOIN bands b ON b.id = a.band_id
      WHERE i.id = ?1`,
  )
    .bind(imageId)
    .first<Band & { image_key: string }>();
  if (!row?.bucket_name) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!(await hasAccess(user?.id, row)))
    return new Response("Members only", {
      status: user ? 403 : 401,
      headers: { "Cache-Control": "no-store" },
    });

  const object = await (
    await getBucketDriver()
  ).get(row.bucket_name, row.image_key, null);
  if (!object) return new Response("Not found", { status: 404 });
  const ext = row.image_key.split(".").pop();
  const type =
    ext === "png"
      ? "image/png"
      : ext === "gif"
        ? "image/gif"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";
  return new Response(object.body, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(object.contentLength),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
