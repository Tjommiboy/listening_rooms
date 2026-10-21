"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";
import type { AdminTrack } from "@/lib/content-reports";

type Action =
  | "disable_track"
  | "enable_track"
  | "disable_band"
  | "enable_band"
  | "resolve_report";

const input =
  "w-full rounded border border-sand bg-white px-3 py-2 text-sm text-ink dark:border-slate/40";
const button =
  "min-h-11 border border-current px-4 text-sm font-bold disabled:opacity-50";

/** The buttons for one report: switch the band or its songs off/on, close it. */
export function AdminReportActions({
  reportId,
  open,
  bandId,
  bandDisabled,
  tracks,
}: {
  reportId: string;
  open: boolean;
  bandId: string | null;
  bandDisabled: boolean;
  tracks: AdminTrack[];
}) {
  const router = useRouter();
  const t = useT().admin;
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: Action, id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, reason, note, reportId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? t.failed);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      {bandId && (
        <>
          <label className="block text-xs font-bold">
            {t.reason}
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              className={`${input} mt-1 font-normal`}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              onClick={() =>
                run(bandDisabled ? "enable_band" : "disable_band", bandId)
              }
              className={button}
            >
              {busy ? t.working : bandDisabled ? t.enableBand : t.disableBand}
            </button>
          </div>
          {tracks.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-bold">
                {t.tracks} ({tracks.length})
              </summary>
              <ul className="mt-3 divide-y divide-sand text-sm dark:divide-slate/40">
                {tracks.map((track) => (
                  <li
                    key={track.id}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <span className="min-w-0 truncate">
                      {track.title}
                      {track.disabled && (
                        <span className="ml-2 text-red-700 dark:text-coral">
                          ({t.trackDisabled})
                        </span>
                      )}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(
                          track.disabled ? "enable_track" : "disable_track",
                          track.id,
                        )
                      }
                      className="shrink-0 font-bold underline disabled:opacity-50"
                    >
                      {track.disabled ? t.enableTrack : t.disableTrack}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {open && (
        <div className="space-y-3 border-t border-sand pt-4 dark:border-slate/40">
          <label className="block text-xs font-bold">
            {t.note}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              className={`${input} mt-1 font-normal`}
            />
          </label>
          <button
            disabled={busy}
            onClick={() => run("resolve_report", reportId)}
            className={`${button} bg-ink text-cream dark:bg-cream dark:text-ink`}
          >
            {busy ? t.working : t.resolve}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
