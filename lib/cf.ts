import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Cloudflare bindings (D1 as DB, R2 as MEDIA). Works in `next dev` too. */
export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
