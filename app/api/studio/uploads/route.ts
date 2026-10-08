import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv, newId } from "@/lib/cf";
import {
  MAX_FILE_BYTES,
  PART_SIZE,
  QUOTA_BYTES,
  ensureBandBucket,
  requireBandOwner,
  storageUsed,
  trackKey,
} from "@/lib/storage";

// Step 1 of an upload: reserve space and open a multipart upload in the
// band's own bucket (created here if it does not exist yet).
export async function POST(request: NextRequest) {
  const ctx = await requireBandOwner({ needsPlan: true });
  if (!ctx.ok) return ctx.response;
  const { band } = ctx;

  const body = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    filename?: unknown;
    contentType?: unknown;
    size?: unknown;
  };
  const filename = typeof body.filename === "string" ? body.filename : "";
  const title =
    (typeof body.title === "string" && body.title.trim()) ||
    filename.replace(/\.[^.]+$/, "");
  const contentType =
    typeof body.contentType === "string" ? body.contentType : "";
  const size = typeof body.size === "number" ? body.size : 0;

  if (!contentType.startsWith("audio/"))
    return NextResponse.json(
      { error: (await getT()).errors.audioOnly },
      { status: 415 },
    );
  if (!Number.isInteger(size) || size <= 0 || size > MAX_FILE_BYTES)
    return NextResponse.json(
      { error: (await getT()).errors.fileSize },
      { status: 413 },
    );

  const used = await storageUsed(band.id);
  if (used.stored + used.reserved + size > QUOTA_BYTES)
    return NextResponse.json(
      { error: (await getT()).errors.quota },
      { status: 413 },
    );

  const { DB } = await getEnv();
  const bucket = await ensureBandBucket(band);
  const trackId = newId("trk");
  const key = trackKey(trackId, filename);
  const r2UploadId = await (
    await getBucketDriver()
  ).createMultipart(bucket, key, contentType);
  const id = trackId; // the upload id becomes the track id when it completes
  const partsTotal = Math.ceil(size / PART_SIZE);
  await DB.prepare(
    `INSERT INTO uploads (id, band_id, r2_upload_id, r2_key, title, content_type, size_bytes, parts_total, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  )
    .bind(
      id,
      band.id,
      r2UploadId,
      key,
      title.slice(0, 120),
      contentType,
      size,
      partsTotal,
      Date.now(),
    )
    .run();

  return NextResponse.json({ uploadId: id, partSize: PART_SIZE, partsTotal });
}
