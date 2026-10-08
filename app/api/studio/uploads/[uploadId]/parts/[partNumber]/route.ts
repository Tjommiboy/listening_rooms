import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getBucketDriver } from "@/lib/band-buckets";
import { PART_SIZE, requireBandOwner } from "@/lib/storage";
import { getUpload } from "@/lib/uploads";

// Step 2: the browser sends each 10 MB chunk here; we write it into the
// band's bucket.
// Every part must be exactly PART_SIZE except the last, so a band can never
// store more than the size it reserved in step 1.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string; partNumber: string }> },
) {
  const ctx = await requireBandOwner({ needsPlan: true });
  if (!ctx.ok) return ctx.response;
  const { uploadId, partNumber: rawPart } = await params;
  const upload = await getUpload(uploadId, ctx.band.id);
  if (!upload)
    return NextResponse.json(
      { error: (await getT()).errors.uploadNotFound },
      { status: 404 },
    );

  const partNumber = Number(rawPart);
  if (
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > upload.parts_total
  )
    return NextResponse.json(
      { error: (await getT()).errors.invalidPart },
      { status: 400 },
    );

  const isLast = partNumber === upload.parts_total;
  const expected = isLast
    ? upload.size_bytes - PART_SIZE * (upload.parts_total - 1)
    : PART_SIZE;
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 0 && declared !== expected)
    return NextResponse.json(
      { error: (await getT()).errors.partSize },
      { status: 400 },
    );

  const data = await request.arrayBuffer();
  if (data.byteLength !== expected)
    return NextResponse.json(
      { error: (await getT()).errors.partSize },
      { status: 400 },
    );

  const etag = await (
    await getBucketDriver()
  ).uploadPart(
    ctx.band.bucket_name!,
    upload.r2_key,
    upload.r2_upload_id,
    partNumber,
    data,
  );
  return NextResponse.json({ partNumber, etag });
}
