import { getEnv } from "@/lib/cf";

// One-time sign-in links for people without Vipps. The link opens a page
// with a "Log in" button (a POST), so mail scanners that open links can't
// use up the token.

const LINK_MINUTES = 30;
/** At most this many links per address per LINK_MINUTES. */
const MAX_LINKS = 5;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function normalizeEmail(value: unknown) {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}

/** Creates a token, or null if this address asked for too many links. */
export async function createLoginToken(email: string, next: string) {
  const { DB } = await getEnv();
  const now = Date.now();
  const recent = await DB.prepare(
    `SELECT COUNT(*) AS n FROM login_tokens WHERE email = ?1 AND expires_at > ?2`,
  )
    .bind(email, now)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_LINKS) return null;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  await DB.prepare(
    `INSERT INTO login_tokens (token_hash, email, next, expires_at) VALUES (?1, ?2, ?3, ?4)`,
  )
    .bind(await sha256(token), email, next, now + LINK_MINUTES * 60_000)
    .run();
  return token;
}

/** Uses up a token. Returns its email and destination, or null. */
export async function consumeLoginToken(token: string) {
  const { DB } = await getEnv();
  const now = Date.now();
  return DB.prepare(
    `UPDATE login_tokens SET used_at = ?2
      WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2
      RETURNING email, next`,
  )
    .bind(await sha256(token), now)
    .first<{ email: string; next: string }>();
}
