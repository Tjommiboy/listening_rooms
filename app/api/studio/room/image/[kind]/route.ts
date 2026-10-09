import { NextRequest, NextResponse } from "next/server";
import { getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { getT } from "@/lib/i18n/server";
import { imageUrl } from "@/lib/room-profile";
import {
  IMAGE_KINDS,
  MAX_IMAGE_BYTES,
  sniffImageType,
  type ImageKind,
} from "@/lib/room-theme";
import { ensureBandBucket, requireBandOwner } from "@/lib/storage";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const COLUMN: Record<ImageKind, string> = {
  avatar: "avatar_key",
  background: "background_key",
};

function kindOf(value: string): ImageKind | null {
  return (IMAGE_KINDS as readonly string[]).includes(value)
    ? (value as ImageKind)
    : null;
}

// Uploads the band's profile picture or background image (max 20 MB) into the
// band's own bucket, under public/. Body: the raw image file.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const kind = kindOf((await params).kind);
  if (!kind) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const t = (await getT()).errors;

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES)
    return NextResponse.json({ error: t.imageSize }, { status: 413 });
  const data = await request.arrayBuffer();
  if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES)
    return NextResponse.json({ error: t.imageSize }, { status: 413 });
  const contentType = sniffImageType(data);
  if (!contentType)
    return NextResponse.json({ error: t.imageType }, { status: 415 });

  const bucket = await ensureBandBucket(ctx.band);
  const key = `public/${kind}-${Date.now()}.${EXT[contentType]}`;
  const driver = await getBucketDriver();
  await driver.put(bucket, key, data, contentType);

  const { DB } = await getEnv();
  const old = await DB.prepare(
    `SELECT ${COLUMN[kind]} AS key FROM bands WHERE id = ?1`,
  )
    .bind(ctx.band.id)
    .first<{ key: string | null }>();
  const version = Date.now();
  await DB.prepare(
    `UPDATE bands SET ${COLUMN[kind]} = ?2, profile_updated_at = ?3 WHERE id = ?1`,
  )
    .bind(ctx.band.id, key, version)
    .run();
  if (old?.key) await driver.delete(bucket, old.key).catch(() => {});

  return NextResponse.json({ url: imageUrl(ctx.band.id, kind, version) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const kind = kindOf((await params).kind);
  if (!kind) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { DB } = await getEnv();
  const old = await DB.prepare(
    `SELECT ${COLUMN[kind]} AS key FROM bands WHERE id = ?1`,
  )
    .bind(ctx.band.id)
    .first<{ key: string | null }>();
  await DB.prepare(
    `UPDATE bands SET ${COLUMN[kind]} = NULL, profile_updated_at = ?2 WHERE id = ?1`,
  )
    .bind(ctx.band.id, Date.now())
    .run();
  if (old?.key && ctx.band.bucket_name)
    await (
      await getBucketDriver()
    )
      .delete(ctx.band.bucket_name, old.key)
      .catch(() => {});
  return NextResponse.json({ ok: true });
}
