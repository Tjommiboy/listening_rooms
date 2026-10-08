import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { requireBandOwner } from "@/lib/storage";
import { getUpload } from "@/lib/uploads";

// Step 3: stitch the parts together in R2 and publish the track in the room.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const ctx = await requireBandOwner({ needsPlan: true });
  if (!ctx.ok) return ctx.response;
  const { uploadId } = await params;
  const upload = await getUpload(uploadId, ctx.band.id);
  if (!upload)
    return NextResponse.json(
      { error: (await getT()).errors.uploadNotFound },
      { status: 404 },
    );

  const body = (await request.json().catch(() => ({}))) as {
    parts?: { partNumber: number; etag: string }[];
  };
  const parts = Array.isArray(body.parts) ? body.parts : [];
  if (parts.length !== upload.parts_total)
    return NextResponse.json(
      { error: (await getT()).errors.missingParts },
      { status: 400 },
    );

  const { DB } = await getEnv();
  const driver = await getBucketDriver();
  const bucket = ctx.band.bucket_name!;
  const size = await driver.completeMultipart(
    bucket,
    upload.r2_key,
    upload.r2_upload_id,
    parts
      .map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) }))
      .sort((a, b) => a.partNumber - b.partNumber),
  );
  if (size !== upload.size_bytes) {
    await driver.delete(bucket, upload.r2_key);
    await DB.prepare("DELETE FROM uploads WHERE id = ?1").bind(upload.id).run();
    return NextResponse.json(
      { error: (await getT()).errors.uploadBroken },
      { status: 400 },
    );
  }

  await DB.batch([
    DB.prepare(
      `INSERT INTO tracks (id, band_id, title, r2_key, content_type, size_bytes, position, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6,
               (SELECT COALESCE(MAX(position), 0) + 1 FROM tracks WHERE band_id = ?2), ?7)`,
    ).bind(
      upload.id,
      upload.band_id,
      upload.title,
      upload.r2_key,
      upload.content_type,
      size,
      Date.now(),
    ),
    DB.prepare("DELETE FROM uploads WHERE id = ?1").bind(upload.id),
  ]);
  return NextResponse.json({
    trackId: upload.id,
    title: upload.title,
    size: size,
  });
}
