import { NextRequest } from "next/server";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { IMAGE_KINDS } from "@/lib/room-theme";

// Public room images (profile picture and background). Unlike tracks these
// are meant to be seen by everyone, so there is no access check. The URL
// carries ?v=<timestamp>, so a new image gets a new URL and can be cached.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bandId: string; kind: string }> },
) {
  const { bandId, kind } = await params;
  if (!(IMAGE_KINDS as readonly string[]).includes(kind))
    return new Response("Not found", { status: 404 });

  const { DB } = await getEnv();
  const column = kind === "avatar" ? "avatar_key" : "background_key";
  const band = await DB.prepare(
    `SELECT bucket_name, ${column} AS key FROM bands WHERE id = ?1`,
  )
    .bind(bandId)
    .first<{ bucket_name: string | null; key: string | null }>();
  if (!band?.bucket_name || !band.key)
    return new Response("Not found", { status: 404 });

  const object = await (
    await getBucketDriver()
  ).get(band.bucket_name, band.key, null);
  if (!object) return new Response("Not found", { status: 404 });

  const ext = band.key.split(".").pop();
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
