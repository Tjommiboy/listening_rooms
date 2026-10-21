import { BAND_GRACE_DAYS, BAND_LOCKED_DAYS } from "@/lib/billing";
import { getEnv } from "@/lib/cf";
import { demoBandPlanEnabled } from "@/lib/demo";
import { STREAM_THRESHOLD_SEC } from "@/lib/plays";
import { imageUrl } from "@/lib/room-profile";

// Discovery: search, newest bands, popular now, and A–Å.
// Only live rooms are shown: a band with an owner whose band plan is paid
// (or in its grace / locked period, when fans can still listen). Trial and
// closed rooms never appear.

const DAY = 86_400_000;
const LIVE_WINDOW_MS = (BAND_GRACE_DAYS + BAND_LOCKED_DAYS) * DAY;
/** "Popular now" counts streams from the last week. */
export const POPULAR_DAYS = 7;

/** SQL condition for "band b is live". Binds ?1 = demo (0/1), ?2 = now. */
const LIVE = `b.owner_id IS NOT NULL AND b.disabled_at IS NULL AND (?1 = 1 OR EXISTS (
  SELECT 1 FROM agreements a
   WHERE a.band_id = b.id AND a.kind = 'band_plan'
     AND a.paid_until IS NOT NULL AND a.paid_until + ${LIVE_WINDOW_MS} > ?2))`;

export type BandCard = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  avatarUrl: string | null;
  streams?: number;
};

type BandRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  avatar_key: string | null;
  profile_updated_at: number | null;
  streams?: number;
};

const BAND_COLUMNS =
  "b.id, b.slug, b.name, b.tagline, b.avatar_key, b.profile_updated_at";

function toCard(row: BandRow): BandCard {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline ?? "",
    avatarUrl: row.avatar_key
      ? imageUrl(row.id, "avatar", row.profile_updated_at ?? 0)
      : null,
    ...(row.streams !== undefined ? { streams: row.streams } : {}),
  };
}

function liveParams(now: number) {
  return [demoBandPlanEnabled() ? 1 : 0, now] as const;
}

export async function newestBands(limit = 8, now = Date.now()) {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT ${BAND_COLUMNS} FROM bands b
      WHERE ${LIVE}
      ORDER BY b.created_at DESC LIMIT ?3`,
  )
    .bind(...liveParams(now), limit)
    .all<BandRow>();
  return results.map(toCard);
}

/** Bands with the most streams (30 s or more, the band itself excluded). */
export async function popularBands(limit = 8, now = Date.now()) {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT ${BAND_COLUMNS}, COUNT(p.id) AS streams
       FROM bands b JOIN plays p ON p.band_id = b.id
      WHERE ${LIVE}
        AND p.started_at > ?3 AND p.seconds >= ?4 AND p.is_owner = 0
      GROUP BY b.id
      ORDER BY streams DESC, b.name COLLATE NOCASE
      LIMIT ?5`,
  )
    .bind(
      ...liveParams(now),
      now - POPULAR_DAYS * DAY,
      STREAM_THRESHOLD_SEC,
      limit,
    )
    .all<BandRow>();
  return results.map(toCard);
}

export async function allBands(now = Date.now()) {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT ${BAND_COLUMNS} FROM bands b WHERE ${LIVE}`,
  )
    .bind(...liveParams(now))
    .all<BandRow>();
  // Sort in JS so Æ, Ø, Å land last, as in Norwegian.
  const collator = new Intl.Collator("nb", { sensitivity: "base" });
  return results.map(toCard).sort((a, b) => collator.compare(a.name, b.name));
}

export type SearchHit = {
  kind: "band" | "album" | "track";
  id: string;
  title: string;
  bandName: string;
  /**
   * Where the hit opens: the band's room. Albums and songs add ?album= or
   * ?track= so the room's player opens with that album or song cued up.
   */
  href: string;
};

/**
 * Turns what the visitor typed into a safe FTS5 query: every word must
 * match, the last one as a prefix ("fjor" finds "Fjorden"). Quotes and FTS
 * operators in the input are treated as plain text.
 */
export function toFtsQuery(input: string) {
  const words = input
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  if (words.length === 0) return null;
  return words.map((w) => `"${w}"*`).join(" ");
}

function hitHref(kind: SearchHit["kind"], slug: string, id: string) {
  const room = `/room/${encodeURIComponent(slug)}`;
  if (kind === "album") return `${room}?album=${encodeURIComponent(id)}`;
  if (kind === "track") return `${room}?track=${encodeURIComponent(id)}`;
  return room;
}

export async function search(input: string, limitPerKind = 6) {
  const query = toFtsQuery(input.slice(0, 100));
  if (!query) return [];
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT s.kind, s.ref_id AS id, s.title, b.name AS band_name, b.slug
       FROM search_index s JOIN bands b ON b.id = s.band_id
      WHERE search_index MATCH ?3 AND ${LIVE}
      ORDER BY s.rank
      LIMIT 60`,
  )
    .bind(...liveParams(Date.now()), query)
    .all<{
      kind: SearchHit["kind"];
      id: string;
      title: string;
      band_name: string;
      slug: string;
    }>();
  const perKind = { band: 0, album: 0, track: 0 };
  const hits: SearchHit[] = [];
  for (const row of results) {
    if (perKind[row.kind]++ >= limitPerKind) continue;
    hits.push({
      kind: row.kind,
      id: row.id,
      title: row.title,
      bandName: row.band_name,
      href: hitHref(row.kind, row.slug, row.id),
    });
  }
  const order = { band: 0, album: 1, track: 2 };
  return hits.sort((a, b) => order[a.kind] - order[b.kind]);
}
