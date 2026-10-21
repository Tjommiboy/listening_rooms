// Pure rules for the room chat: no imports, so they can be tested with
// `npm test`. Messages are always shown as plain text.

export const CHAT_MAX_LENGTH = 1000;
/** A visitor may write this many messages per window in one room. */
export const CHAT_MAX_PER_WINDOW = 10;
export const CHAT_WINDOW_MS = 10 * 60_000;
/** Threads shown at once, and replies loaded for them. */
export const CHAT_THREADS = 50;
/** The most first messages one page load will show ("Load older" adds 50 at a time). */
export const CHAT_THREADS_MAX = 500;

/** How many first messages to show: `?chat=` rounded to whole pages of 50. */
export function chatLimit(raw: string | undefined): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= CHAT_THREADS) return CHAT_THREADS;
  return Math.min(Math.ceil(n / CHAT_THREADS) * CHAT_THREADS, CHAT_THREADS_MAX);
}
export const CHAT_REPLIES = 500;

// Characters that hide or reorder text: control characters (except new line
// and tab), zero-width characters and bidirectional overrides.
function isHidden(code: number) {
  return (
    (code < 32 && code !== 10 && code !== 9) ||
    code === 127 ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

export type ChatMessageError = "empty" | "too_long";

/** Cleans a message and checks its length. Too long is refused, not cut off. */
export function parseChatMessage(
  input: unknown,
): { ok: true; text: string } | { ok: false; error: ChatMessageError } {
  if (typeof input !== "string") return { ok: false, error: "empty" };
  let text = "";
  for (const char of input.replaceAll("\r\n", "\n").replaceAll("\r", "\n"))
    if (!isHidden(char.codePointAt(0) ?? 0)) text += char;
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return { ok: false, error: "empty" };
  if (text.length > CHAT_MAX_LENGTH) return { ok: false, error: "too_long" };
  return { ok: true, text };
}

/** Fans appear with their first name only. */
export function chatDisplayName(
  name: string | null | undefined,
  fallback: string,
) {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.slice(0, 30) : fallback;
}
