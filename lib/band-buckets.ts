import { AwsClient } from "aws4fetch";
import { getEnv, isProduction } from "@/lib/cf";

// Every band gets its own private R2 bucket in the Listening Rooms Cloudflare
// account, created automatically through the Cloudflare API when the band is
// set up. Bands never see Cloudflare.
//
// Workers can only bind to buckets listed in wrangler.jsonc, and these
// buckets are created at runtime, so reads and writes use R2's S3-compatible
// API with one account-level R2 access key instead of a binding.
//
// Production needs (as Worker secrets):
//   R2_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (permission: Workers R2 Storage: Edit),
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (R2 API token: Object Read & Write,
//   applied to all buckets).
//
// Locally, without those keys, a stand-in driver keeps each "bucket" as a
// folder inside the local R2 binding, so the whole flow works offline.

export type StoredObject = {
  status: 200 | 206;
  body: ReadableStream | null;
  size: number;
  contentLength: number;
  contentRange?: string;
  etag?: string;
};

export interface BucketDriver {
  readonly kind: "r2-api" | "local";
  createBucket(bucket: string): Promise<void>;
  createMultipart(
    bucket: string,
    key: string,
    contentType: string,
  ): Promise<string>;
  uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: ArrayBuffer,
  ): Promise<string>;
  /** Returns the final object size in bytes. */
  completeMultipart(
    bucket: string,
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<number>;
  abortMultipart(bucket: string, key: string, uploadId: string): Promise<void>;
  /** null when the object does not exist. Throws RangeNotSatisfiable. */
  get(
    bucket: string,
    key: string,
    range: string | null,
  ): Promise<StoredObject | null>;
  delete(bucket: string, key: string): Promise<void>;
  /** Single-request upload for small files (room images). */
  put(
    bucket: string,
    key: string,
    data: ArrayBuffer,
    contentType: string,
  ): Promise<void>;
}

export class RangeNotSatisfiable extends Error {}

/** Bucket names: 3–63 chars, lowercase letters, digits and hyphens. */
export function bucketNameFor(bandId: string) {
  return `lr-${bandId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(0, 63);
}

// ---------------------------------------------------------------------------
// Production: real per-band buckets via the Cloudflare API + S3 API

const xmlValue = (xml: string, tag: string) =>
  new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)?.[1];

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

class R2ApiDriver implements BucketDriver {
  readonly kind = "r2-api" as const;
  private s3: AwsClient;
  private endpoint: string;
  private apiBase: string;

  constructor(
    private accountId: string,
    private apiToken: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.s3 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    });
    // Overridable so the driver can be tested against an S3 emulator.
    this.endpoint =
      process.env.R2_S3_ENDPOINT ??
      `https://${accountId}.r2.cloudflarestorage.com`;
    this.apiBase =
      process.env.CLOUDFLARE_API_BASE ?? "https://api.cloudflare.com/client/v4";
  }

  private url(bucket: string, key: string, query = "") {
    const path = key.split("/").map(encodeURIComponent).join("/");
    return `${this.endpoint}/${bucket}/${path}${query}`;
  }

  private async s3Fetch(url: string, init: RequestInit = {}) {
    const response = await this.s3.fetch(url, init);
    if (!response.ok && response.status !== 404 && response.status !== 416) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `R2 ${init.method ?? "GET"} failed (${response.status}): ${detail.slice(0, 300)}`,
      );
    }
    return response;
  }

  async createBucket(bucket: string) {
    const response = await fetch(
      `${this.apiBase}/accounts/${this.accountId}/r2/buckets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        // Western Europe, close to Norwegian listeners.
        body: JSON.stringify({ name: bucket, locationHint: "weur" }),
      },
    );
    if (response.ok) return;
    const data = (await response.json().catch(() => ({}))) as {
      errors?: { code: number; message: string }[];
    };
    // 10004: the bucket already exists (e.g. a retry after a timeout).
    if (data.errors?.some((e) => e.code === 10004)) return;
    throw new Error(
      `Could not create bucket ${bucket} (${response.status}): ${data.errors?.map((e) => e.message).join("; ") ?? ""}`,
    );
  }

  async createMultipart(bucket: string, key: string, contentType: string) {
    const response = await this.s3Fetch(this.url(bucket, key, "?uploads"), {
      method: "POST",
      headers: { "Content-Type": contentType },
    });
    const uploadId = xmlValue(await response.text(), "UploadId");
    if (!uploadId) throw new Error("R2 returned no UploadId.");
    return uploadId;
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: ArrayBuffer,
  ) {
    const response = await this.s3Fetch(
      this.url(
        bucket,
        key,
        `?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`,
      ),
      { method: "PUT", body: data },
    );
    const etag = response.headers.get("etag");
    if (!etag) throw new Error("R2 returned no ETag for the part.");
    return etag;
  }

  async completeMultipart(
    bucket: string,
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ) {
    const body =
      "<CompleteMultipartUpload>" +
      parts
        .map(
          (p) =>
            `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${escapeXml(p.etag)}</ETag></Part>`,
        )
        .join("") +
      "</CompleteMultipartUpload>";
    const response = await this.s3Fetch(
      this.url(bucket, key, `?uploadId=${encodeURIComponent(uploadId)}`),
      { method: "POST", body, headers: { "Content-Type": "application/xml" } },
    );
    const text = await response.text();
    // S3 can answer 200 with an <Error> body for a failed completion.
    if (text.includes("<Error>"))
      throw new Error(
        `R2 could not complete the upload: ${xmlValue(text, "Message")}`,
      );
    const head = await this.s3Fetch(this.url(bucket, key), { method: "HEAD" });
    return Number(head.headers.get("content-length") ?? -1);
  }

  async abortMultipart(bucket: string, key: string, uploadId: string) {
    await this.s3Fetch(
      this.url(bucket, key, `?uploadId=${encodeURIComponent(uploadId)}`),
      { method: "DELETE" },
    );
  }

  async get(bucket: string, key: string, range: string | null) {
    const response = await this.s3Fetch(this.url(bucket, key), {
      headers: range ? { Range: range } : {},
    });
    if (response.status === 404) return null;
    if (response.status === 416) throw new RangeNotSatisfiable();
    const contentRange = response.headers.get("content-range") ?? undefined;
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    const size = contentRange
      ? Number(contentRange.split("/")[1])
      : contentLength;
    return {
      status: response.status === 206 ? 206 : 200,
      body: response.body,
      size,
      contentLength,
      contentRange,
      etag: response.headers.get("etag") ?? undefined,
    } satisfies StoredObject;
  }

  async put(
    bucket: string,
    key: string,
    data: ArrayBuffer,
    contentType: string,
  ) {
    await this.s3Fetch(this.url(bucket, key), {
      method: "PUT",
      body: data,
      headers: { "Content-Type": contentType },
    });
  }

  async delete(bucket: string, key: string) {
    await this.s3Fetch(this.url(bucket, key), { method: "DELETE" });
  }
}

// ---------------------------------------------------------------------------
// Local development: each band "bucket" is a folder in the local R2 binding.

class LocalDriver implements BucketDriver {
  readonly kind = "local" as const;
  constructor(private media: R2Bucket) {}

  private k(bucket: string, key: string) {
    return `${bucket}/${key}`;
  }

  async createBucket() {}

  async createMultipart(bucket: string, key: string, contentType: string) {
    const upload = await this.media.createMultipartUpload(this.k(bucket, key), {
      httpMetadata: { contentType },
    });
    return upload.uploadId;
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: ArrayBuffer,
  ) {
    const part = await this.media
      .resumeMultipartUpload(this.k(bucket, key), uploadId)
      .uploadPart(partNumber, data);
    return part.etag;
  }

  async completeMultipart(
    bucket: string,
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ) {
    const object = await this.media
      .resumeMultipartUpload(this.k(bucket, key), uploadId)
      .complete(parts);
    return object.size;
  }

  async abortMultipart(bucket: string, key: string, uploadId: string) {
    await this.media
      .resumeMultipartUpload(this.k(bucket, key), uploadId)
      .abort();
  }

  async get(bucket: string, key: string, range: string | null) {
    let object: R2ObjectBody | null;
    try {
      object = await this.media.get(this.k(bucket, key), {
        range: range ? new Headers({ range }) : undefined,
      });
    } catch {
      throw new RangeNotSatisfiable();
    }
    if (!object) return null;
    if (range && object.range) {
      const r = object.range as {
        offset?: number;
        length?: number;
        suffix?: number;
      };
      const offset =
        r.suffix !== undefined ? object.size - r.suffix : (r.offset ?? 0);
      const length =
        r.suffix !== undefined ? r.suffix : (r.length ?? object.size - offset);
      return {
        status: 206,
        body: object.body,
        size: object.size,
        contentLength: length,
        contentRange: `bytes ${offset}-${offset + length - 1}/${object.size}`,
        etag: object.httpEtag,
      } satisfies StoredObject;
    }
    return {
      status: 200,
      body: object.body,
      size: object.size,
      contentLength: object.size,
      etag: object.httpEtag,
    } satisfies StoredObject;
  }

  async put(
    bucket: string,
    key: string,
    data: ArrayBuffer,
    contentType: string,
  ) {
    await this.media.put(this.k(bucket, key), data, {
      httpMetadata: { contentType },
    });
  }

  async delete(bucket: string, key: string) {
    await this.media.delete(this.k(bucket, key));
  }
}

// ---------------------------------------------------------------------------

export async function getBucketDriver(): Promise<BucketDriver> {
  const {
    R2_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
  } = process.env;
  if (
    R2_ACCOUNT_ID &&
    CLOUDFLARE_API_TOKEN &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY
  )
    return new R2ApiDriver(
      R2_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
    );
  if (isProduction())
    throw new Error(
      "R2_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, R2_ACCESS_KEY_ID og R2_SECRET_ACCESS_KEY må være satt.",
    );
  const { DEV_MEDIA } = await getEnv();
  return new LocalDriver(DEV_MEDIA);
}
