import { NextRequest } from "next/server";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";

// Public album cover image (like room images, covers are meant to be seen).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const { albumId } = await params;
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT a.cover_key, b.bucket_name FROM albums a
       JOIN bands b ON b.id = a.band_id WHERE a.id = ?1`,
  )
    .bind(albumId)
    .first<{ cover_key: string | null; bucket_name: string | null }>();
  if (!row?.cover_key || !row.bucket_name)
    return new Response("Not found", { status: 404 });
  const object = await (
    await getBucketDriver()
  ).get(row.bucket_name, row.cover_key, null);
  if (!object) return new Response("Not found", { status: 404 });
  const ext = row.cover_key.split(".").pop();
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
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
