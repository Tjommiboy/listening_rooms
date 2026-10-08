import { cookies } from "next/headers";
import { getEnv, newId } from "@/lib/cf";

export const SESSION_COOKIE = "lr_session";
const SESSION_DAYS = 30;

export type User = {
  id: string;
  vipps_sub: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** Finds or creates the user for a Vipps identity (or a local dev identity). */
export async function upsertUser(input: {
  vippsSub: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<User> {
  const { DB } = await getEnv();
  await DB.prepare(
    `INSERT INTO users (id, vipps_sub, name, phone, email, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (vipps_sub) DO UPDATE SET
       name = COALESCE(excluded.name, users.name),
       phone = COALESCE(excluded.phone, users.phone),
       email = COALESCE(excluded.email, users.email)`,
  )
    .bind(
      newId("usr"),
      input.vippsSub,
      input.name ?? null,
      input.phone ?? null,
      input.email ?? null,
      Date.now(),
    )
    .run();
  const user = await DB.prepare(
    "SELECT id, vipps_sub, name, phone, email FROM users WHERE vipps_sub = ?1",
  )
    .bind(input.vippsSub)
    .first<User>();
  if (!user) throw new Error("Kunne ikke lagre brukeren.");
  return user;
}

/** Starts a session and sets the httpOnly cookie. Call from a route handler. */
export async function startSession(userId: string) {
  const { DB } = await getEnv();
  const token = randomToken();
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000;
  await DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)",
  )
    .bind(await sha256(token), userId, expiresAt)
    .run();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/** The signed-in user, or null. Usable in pages and route handlers. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { DB } = await getEnv();
  return DB.prepare(
    `SELECT u.id, u.vipps_sub, u.name, u.phone, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
  )
    .bind(await sha256(token), Date.now())
    .first<User>();
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const { DB } = await getEnv();
    await DB.prepare("DELETE FROM sessions WHERE token_hash = ?1")
      .bind(await sha256(token))
      .run();
  }
  jar.delete(SESSION_COOKIE);
}
