import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { bandPlanActive, getBandByOwner, type Band } from "@/lib/access";
import { bucketNameFor, getBucketDriver } from "@/lib/band-buckets";
import { getEnv } from "@/lib/cf";
import { ARTIST_STORAGE_GB } from "@/lib/pricing";
import { getCurrentUser, type User } from "@/lib/session";

// How bands store files without ever touching Cloudflare themselves:
// each band has its own private R2 bucket in the Listening Rooms Cloudflare
// account, created automatically (lib/band-buckets.ts). The browser sends
// files to our own API in 10 MB chunks and the API writes them into the
// band's bucket. No R2 keys or Cloudflare accounts are exposed to bands.

export const PART_SIZE = 10 * 1024 * 1024; // R2 needs equal parts (≥ 5 MiB) except the last
export const MAX_FILE_BYTES = 2 * 1024 ** 3;
export const QUOTA_BYTES = ARTIST_STORAGE_GB * 1024 ** 3;
const STALE_UPLOAD_MS = 24 * 3_600_000;

/** Object key inside the band's own bucket. */
export function trackKey(trackId: string, filename: string) {
  const ext =
    /\.([a-z0-9]{1,5})$/i.exec(filename)?.[1]?.toLowerCase() ?? "audio";
  return `tracks/${trackId}.${ext}`;
}

/**
 * Makes sure the band has its private bucket and returns its name. Normally
 * the bucket is created with the band; this retries if that failed.
 */
export async function ensureBandBucket(band: Band) {
  if (band.bucket_name) return band.bucket_name;
  const bucket = bucketNameFor(band.id);
  await (await getBucketDriver()).createBucket(bucket);
  const { DB } = await getEnv();
  await DB.prepare("UPDATE bands SET bucket_name = ?2 WHERE id = ?1")
    .bind(band.id, bucket)
    .run();
  band.bucket_name = bucket;
  return bucket;
}

/** Bytes stored plus bytes reserved by uploads still in progress. */
export async function storageUsed(bandId: string) {
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT
       (SELECT COALESCE(SUM(size_bytes), 0) FROM tracks WHERE band_id = ?1 AND deleted_at IS NULL) AS stored,
       (SELECT COALESCE(SUM(size_bytes), 0) FROM uploads
         WHERE band_id = ?1 AND created_at > ?2) AS reserved`,
  )
    .bind(bandId, Date.now() - STALE_UPLOAD_MS)
    .first<{ stored: number; reserved: number }>();
  return { stored: row?.stored ?? 0, reserved: row?.reserved ?? 0 };
}

type OwnerContext =
  { ok: true; user: User; band: Band } | { ok: false; response: NextResponse };

/** The signed-in user and the band they own, or an error response. */
export async function requireBandOwner(
  opts: { needsPlan?: boolean } = {},
): Promise<OwnerContext> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      response: NextResponse.json(
        { error: (await getT()).errors.loginFirst },
        { status: 401 },
      ),
    };
  const band = await getBandByOwner(user.id);
  if (!band)
    return {
      ok: false,
      response: NextResponse.json(
        { error: (await getT()).errors.noBand },
        { status: 403 },
      ),
    };
  if (opts.needsPlan && !(await bandPlanActive(band.id)))
    return {
      ok: false,
      response: NextResponse.json(
        { error: (await getT()).errors.planRequired },
        { status: 402 },
      ),
    };
  return { ok: true, user, band };
}
