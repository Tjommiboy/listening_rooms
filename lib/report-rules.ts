// Pure rules for the report form: no imports, so they can be tested with
// `npm test`. The route and the form both use them.

export const REPORT_CATEGORIES = ["rights", "other"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_LIMITS = {
  description: { min: 10, max: 2000 },
  room: 200,
  song: 200,
  name: 100,
  email: 200,
} as const;

/** Max reports from one visitor (by hashed IP) per hour. */
export const REPORTS_PER_HOUR = 5;

export type ReportDraft = {
  category: ReportCategory;
  room: string;
  song: string;
  description: string;
  name: string;
  email: string;
};

export type ReportError = "category" | "description" | "email";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Checks and cleans what the form sent. */
export function parseReport(
  body: unknown,
): { ok: true; value: ReportDraft } | { ok: false; error: ReportError } {
  const input = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const category = REPORT_CATEGORIES.find((c) => c === input.category);
  if (!category) return { ok: false, error: "category" };
  const description = text(input.description, REPORT_LIMITS.description.max);
  if (description.length < REPORT_LIMITS.description.min)
    return { ok: false, error: "description" };
  const email = text(input.email, REPORT_LIMITS.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "email" };
  return {
    ok: true,
    value: {
      category,
      room: text(input.room, REPORT_LIMITS.room),
      song: text(input.song, REPORT_LIMITS.song),
      description,
      name: text(input.name, REPORT_LIMITS.name),
      email,
    },
  };
}

/**
 * The band address in what the reporter typed: a plain address ("fjorden")
 * or a link ("https://…/room/fjorden?track=…"). Null if it doesn't look like one.
 */
export function slugFromRoomText(input: string) {
  const fromLink = /\/room\/([a-z0-9-]{3,40})(?:[/?#]|$)/i.exec(input);
  const raw = (fromLink ? fromLink[1] : input.trim()).toLowerCase();
  return /^[a-z0-9-]{3,40}$/.test(raw) ? raw : null;
}
