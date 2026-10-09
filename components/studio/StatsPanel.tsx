"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { formatNumber } from "@/lib/i18n/dictionaries";
import type { BandSummary, Rights, TrackRow } from "@/lib/reports";

type Data = { month: string; rows: TrackRow[]; summary: BandSummary | null };

/** The last 12 months as "YYYY-MM", newest first. */
function lastMonths(current: string) {
  const [y, m] = current.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function StatsPanel({
  currentMonth,
  isAdmin,
}: {
  currentMonth: string;
  isAdmin: boolean;
}) {
  const t = useT().stats;
  const locale = useLocale();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<Data | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async (which: string) => {
    const response = await fetch(`/api/studio/stats?month=${which}`);
    if (response.ok) setData((await response.json()) as Data);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/studio/stats?month=${month}`)
      .then((r) => (r.ok ? (r.json() as Promise<Data>) : null))
      .then((d) => {
        if (active && d) setData(d);
      });
    return () => {
      active = false;
    };
  }, [month]);

  const num = (n: number, digits = 0) => formatNumber(locale, n, digits);
  const s = data?.summary;
  const monthLabel = (value: string) =>
    new Intl.DateTimeFormat(locale === "nb" ? "nb-NO" : "en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}-01T00:00:00Z`));

  return (
    <section className="mt-16">
      <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
        {t.eyebrow}
      </p>
      <h2 className="serif mt-3 text-4xl tracking-[-.06em]">{t.title}</h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-moss dark:text-stone">
        {t.intro}
      </p>

      <label className="mt-6 flex items-center gap-3 text-sm font-bold">
        {t.month}
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border border-sand bg-white px-2 py-1 font-normal text-ink dark:border-slate/40"
        >
          {lastMonths(currentMonth).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>

      {!data ? (
        <p className="mt-6 text-moss dark:text-stone">{t.loading}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label={t.streams} value={num(s?.streams ?? 0)} />
            <Stat label={t.minutes} value={num(s?.minutes ?? 0, 0)} />
            <Stat label={t.listeners} value={num(s?.listeners ?? 0)} />
            <Stat
              label={t.revenue}
              value={`${num(s?.revenue_nok ?? 0)} kr`}
              hint={t.revenueHint}
            />
            <Stat
              label={t.tonoEstimate}
              value={`${num(s?.tono_estimate_nok ?? 0, 2)} kr`}
              hint={t.tonoHint}
            />
          </div>

          {s && s.tracks_missing_rights > 0 && (
            <p
              role="status"
              className="mt-4 rounded bg-sun/60 px-3 py-2 text-sm text-ink"
            >
              ⚠ {t.missingWarning(s.tracks_missing_rights)}
            </p>
          )}

          {data.rows.length === 0 ? (
            <p className="mt-6 text-moss dark:text-stone">{t.empty}</p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-sand dark:border-slate/40">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-sage/60 text-xs uppercase tracking-[.1em] dark:bg-ink">
                  <tr>
                    <th className="px-4 py-3">{t.track}</th>
                    <th className="px-4 py-3 text-right">{t.streams}</th>
                    <th className="px-4 py-3 text-right">{t.minutes}</th>
                    <th className="px-4 py-3 text-right">{t.listeners}</th>
                    <th className="px-4 py-3">{t.rights}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <TrackStatsRow
                      key={row.track_id}
                      row={row}
                      open={editing === row.track_id}
                      onToggle={() =>
                        setEditing(
                          editing === row.track_id ? null : row.track_id,
                        )
                      }
                      onSaved={() => load(month)}
                      num={num}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-4 text-sm font-bold">
            <a
              className="underline"
              href={`/api/reports/tono?month=${month}&type=tracks`}
            >
              ↓ {t.downloadTracks}
            </a>
            <a
              className="underline"
              href={`/api/reports/tono?month=${month}&type=summary`}
            >
              ↓ {t.downloadSummary}
            </a>
            {isAdmin && (
              <a
                className="underline"
                href={`/api/reports/tono?month=${month}&type=tracks&scope=all`}
              >
                ↓ {t.adminAll}
              </a>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-sand bg-white/40 p-4 dark:border-slate/40 dark:bg-white/5">
      <p className="text-xs font-bold text-moss dark:text-stone">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && (
        <p className="mt-1 text-[11px] leading-tight text-moss dark:text-stone">
          {hint}
        </p>
      )}
    </div>
  );
}

function TrackStatsRow({
  row,
  open,
  onToggle,
  onSaved,
  num,
}: {
  row: TrackRow;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
  num: (n: number, digits?: number) => string;
}) {
  const t = useT().stats;
  const [rights, setRights] = useState<Rights>(row.rights);
  const [writers, setWriters] = useState(row.writers ?? "");
  const [originalTitle, setOriginalTitle] = useState(row.original_title ?? "");
  const [iswc, setIswc] = useState(row.iswc ?? "");
  const [isrc, setIsrc] = useState(row.isrc ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/studio/tracks/${row.track_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rights, writers, originalTitle, iswc, isrc }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Error");
    setMessage(t.saved);
    onSaved();
  }

  const field =
    "mt-1 w-full rounded border border-sand bg-white px-2 py-1.5 text-ink dark:border-slate/40";

  return (
    <>
      <tr className="border-t border-sand dark:border-slate/40">
        <td className="px-4 py-3 font-bold">
          {row.title}
          {row.deleted_at && (
            <span className="ml-2 text-xs font-normal opacity-70">
              ({t.deleted})
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {num(row.streams)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {num(row.minutes, 1)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {num(row.listeners)}
        </td>
        <td className="px-4 py-3">
          <span className="flex items-center justify-between gap-3">
            {row.rights ? (
              <span>{t.rightsLabels[row.rights]}</span>
            ) : (
              <span className="rounded bg-sun/70 px-2 py-0.5 text-xs font-bold text-ink">
                {t.missing}
              </span>
            )}
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="text-xs font-bold underline"
            >
              {open ? t.close : t.edit}
            </button>
          </span>
        </td>
      </tr>
      {open && (
        <tr className="bg-sage/30 dark:bg-white/5">
          <td colSpan={5} className="px-4 py-4">
            <fieldset>
              <legend className="text-sm font-bold">{t.rights}</legend>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {(["own", "tono", "cover"] as const).map((value) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`rights-${row.track_id}`}
                      checked={rights === value}
                      onChange={() => setRights(value)}
                    />
                    {t.rightsLabels[value]}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-moss dark:text-stone">
                {t.rightsHelp}
              </p>
            </fieldset>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-bold">
                {t.writers}
                <input
                  value={writers}
                  onChange={(e) => setWriters(e.target.value)}
                  maxLength={300}
                  className={field}
                />
              </label>
              {rights === "cover" && (
                <label className="text-sm font-bold">
                  {t.originalTitle}
                  <input
                    value={originalTitle}
                    onChange={(e) => setOriginalTitle(e.target.value)}
                    maxLength={200}
                    className={field}
                  />
                </label>
              )}
              <label className="text-sm font-bold">
                {t.iswc}
                <input
                  value={iswc}
                  onChange={(e) => setIswc(e.target.value)}
                  placeholder="T-123.456.789-0"
                  className={`${field} font-mono`}
                />
              </label>
              <label className="text-sm font-bold">
                {t.isrc}
                <input
                  value={isrc}
                  onChange={(e) => setIsrc(e.target.value)}
                  placeholder="NO-ABC-26-00001"
                  className={`${field} font-mono`}
                />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="bg-ink px-4 py-2 text-sm font-bold text-paper disabled:opacity-50 dark:bg-clay dark:text-ink"
              >
                {t.save}
              </button>
              {message && (
                <span role="status" className="text-sm">
                  {message}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
