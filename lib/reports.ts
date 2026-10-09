import { getEnv } from "@/lib/cf";
import { STREAM_THRESHOLD_SEC } from "@/lib/plays";

// Monthly usage reports: what was played, by whom it was written, and a
// rough estimate of the TONO fee. TONO's on-demand streaming rate (2026):
// 12 % of revenue, minimum 5 øre per streamed music minute.
// https://en.tono.no/customers/online/
export const TONO_RATE = 0.12;
export const TONO_MIN_PER_MINUTE_NOK = 0.05;
export const VAT_RATE = 0.25;

export type Rights = "own" | "tono" | "cover" | null;

export type TrackRow = {
  band_id: string;
  band_name: string;
  band_slug: string;
  track_id: string;
  title: string;
  rights: Rights;
  writers: string | null;
  original_title: string | null;
  iswc: string | null;
  isrc: string | null;
  duration_sec: number | null;
  deleted_at: number | null;
  streams: number;
  minutes: number;
  listeners: number;
};

export type BandSummary = {
  band_id: string;
  band_name: string;
  streams: number;
  minutes: number;
  listeners: number; // unique fans who played anything this month
  /** Minutes of tracks TONO may claim: TONO works, covers and unknown. */
  repertoire_minutes: number;
  tracks_missing_rights: number;
  revenue_nok: number; // fan payments captured this month, incl. VAT
  revenue_ex_vat_nok: number;
  tono_estimate_nok: number;
};

/** "2026-10" → [start, end) in milliseconds, Norwegian time. */
export function monthRange(month: string): [number, number] | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  return [osloMidnight(y, m), osloMidnight(m === 11 ? y + 1 : y, (m + 1) % 12)];
}

function osloMidnight(year: number, month: number) {
  // Find the UTC instant that is 00:00 on the 1st in Europe/Oslo.
  const guess = Date.UTC(year, month, 1);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(guess));
  return guess - Number(parts) * 3_600_000;
}

export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  return parts.slice(0, 7);
}

/** Per-track usage for one month. bandId = null means all bands. */
export async function trackReport(
  month: string,
  bandId: string | null,
): Promise<TrackRow[]> {
  const range = monthRange(month);
  if (!range) return [];
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT b.id AS band_id, b.name AS band_name, b.slug AS band_slug,
            t.id AS track_id, t.title, t.rights, t.writers, t.original_title,
            t.iswc, t.isrc, t.duration_sec, t.deleted_at,
            COALESCE(SUM(CASE WHEN p.seconds >= ?4 THEN 1 ELSE 0 END), 0) AS streams,
            COALESCE(ROUND(SUM(p.seconds) / 60.0, 1), 0) AS minutes,
            COUNT(DISTINCT p.user_id) AS listeners
       FROM tracks t
       JOIN bands b ON b.id = t.band_id
       LEFT JOIN plays p
              ON p.track_id = t.id AND p.is_owner = 0
             AND p.started_at >= ?1 AND p.started_at < ?2
      WHERE (?3 IS NULL OR b.id = ?3)
      GROUP BY t.id
      -- Deleted tracks only show up in months where they were played.
     HAVING t.deleted_at IS NULL OR COUNT(p.id) > 0
      ORDER BY b.name, t.position, t.created_at`,
  )
    .bind(range[0], range[1], bandId, STREAM_THRESHOLD_SEC)
    .all<TrackRow>();
  return results;
}

/** Revenue and TONO estimate per band for one month. */
export async function bandSummaries(
  month: string,
  rows: TrackRow[],
): Promise<BandSummary[]> {
  const range = monthRange(month);
  if (!range) return [];
  const { DB } = await getEnv();
  const { results: revenue } = await DB.prepare(
    `SELECT band_id, SUM(amount_ore) AS ore FROM payments
      WHERE kind = 'fan' AND captured_at >= ?1 AND captured_at < ?2
      GROUP BY band_id`,
  )
    .bind(range[0], range[1])
    .all<{ band_id: string; ore: number }>();
  const revenueByBand = new Map(revenue.map((r) => [r.band_id, r.ore / 100]));
  const { results: listeners } = await DB.prepare(
    `SELECT band_id, COUNT(DISTINCT user_id) AS n FROM plays
      WHERE is_owner = 0 AND started_at >= ?1 AND started_at < ?2
      GROUP BY band_id`,
  )
    .bind(range[0], range[1])
    .all<{ band_id: string; n: number }>();
  const listenersByBand = new Map(listeners.map((r) => [r.band_id, r.n]));

  const bands = new Map<string, BandSummary>();
  for (const row of rows) {
    let s = bands.get(row.band_id);
    if (!s) {
      s = {
        band_id: row.band_id,
        band_name: row.band_name,
        streams: 0,
        minutes: 0,
        listeners: listenersByBand.get(row.band_id) ?? 0,
        repertoire_minutes: 0,
        tracks_missing_rights: 0,
        revenue_nok: revenueByBand.get(row.band_id) ?? 0,
        revenue_ex_vat_nok: 0,
        tono_estimate_nok: 0,
      };
      bands.set(row.band_id, s);
    }
    s.streams += row.streams;
    s.minutes += row.minutes;
    // Unknown rights are counted as TONO repertoire, to stay on the safe side.
    if (row.rights !== "own") s.repertoire_minutes += row.minutes;
    if (!row.rights) s.tracks_missing_rights += 1;
  }

  for (const s of bands.values()) {
    s.minutes = round(s.minutes, 1);
    s.repertoire_minutes = round(s.repertoire_minutes, 1);
    s.revenue_ex_vat_nok = round(s.revenue_nok / (1 + VAT_RATE), 2);
    const share = s.minutes > 0 ? s.repertoire_minutes / s.minutes : 0;
    // TONO: the higher of 12 % of (the repertoire's share of) revenue and
    // 5 øre per repertoire minute. An estimate — TONO's invoice decides.
    s.tono_estimate_nok = round(
      Math.max(
        TONO_RATE * s.revenue_ex_vat_nok * share,
        TONO_MIN_PER_MINUTE_NOK * s.repertoire_minutes,
      ),
      2,
    );
  }
  return [...bands.values()];
}

const round = (n: number, digits: number) =>
  Math.round(n * 10 ** digits) / 10 ** digits;

// --- CSV (semicolon-separated with BOM, so Excel in Norway opens it right) ---

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formulas typed into free-text fields.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[;"\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]) {
  return (
    "﻿" +
    [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") +
    "\r\n"
  );
}

export function tracksCsv(month: string, rows: TrackRow[]) {
  return toCsv(
    [
      "month",
      "band",
      "band_slug",
      "track_id",
      "track_title",
      "rights",
      "writers",
      "original_title",
      "iswc",
      "isrc",
      "duration_sec",
      "streams",
      "minutes",
      "unique_listeners",
    ],
    rows.map((r) => [
      month,
      r.band_name,
      r.band_slug,
      r.track_id,
      r.title,
      r.rights ?? "unknown",
      r.writers,
      r.original_title,
      r.iswc,
      r.isrc,
      r.duration_sec,
      r.streams,
      r.minutes,
      r.listeners,
    ]),
  );
}

export function summaryCsv(month: string, rows: BandSummary[]) {
  return toCsv(
    [
      "month",
      "band",
      "streams",
      "minutes",
      "repertoire_minutes",
      "tracks_missing_rights",
      "revenue_nok_incl_vat",
      "revenue_nok_ex_vat",
      "tono_estimate_nok",
    ],
    rows.map((s) => [
      month,
      s.band_name,
      s.streams,
      s.minutes,
      s.repertoire_minutes,
      s.tracks_missing_rights,
      s.revenue_nok,
      s.revenue_ex_vat_nok,
      s.tono_estimate_nok,
    ]),
  );
}
