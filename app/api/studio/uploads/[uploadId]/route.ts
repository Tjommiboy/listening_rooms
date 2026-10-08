import { NextRequest, NextResponse } from "next/server";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { requireBandOwner } from "@/lib/storage";
import { getUpload } from "@/lib/uploads";

// Cancels an upload and frees the reserved space.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const { uploadId } = await params;
  const upload = await getUpload(uploadId, ctx.band.id);
  if (!upload) return NextResponse.json({ ok: true });
  const { DB } = await getEnv();
  await (
    await getBucketDriver()
  )
    .abortMultipart(ctx.band.bucket_name!, upload.r2_key, upload.r2_upload_id)
    .catch(() => {});
  await DB.prepare("DELETE FROM uploads WHERE id = ?1").bind(upload.id).run();
  return NextResponse.json({ ok: true });
}
