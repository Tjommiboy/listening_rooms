"use client";

import { useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { formatNumber } from "@/lib/i18n/dictionaries";

type Track = { id: string; title: string; size_bytes: number };
type Progress = { name: string; sent: number; total: number; error?: string };

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

/**
 * Uploads straight into the band's private storage through our own API, in
 * 10 MB chunks. The band never sees R2 or any Cloudflare account.
 */
async function uploadFile(file: File, onProgress: (sent: number) => void) {
  const { uploadId, partSize, partsTotal } = await api<{
    uploadId: string;
    partSize: number;
    partsTotal: number;
  }>("/api/studio/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "audio/mpeg",
      size: file.size,
    }),
  });

  try {
    const parts: { partNumber: number; etag: string }[] = [];
    for (let n = 1; n <= partsTotal; n++) {
      const chunk = file.slice((n - 1) * partSize, n * partSize);
      parts.push(
        await api(`/api/studio/uploads/${uploadId}/parts/${n}`, {
          method: "PUT",
          body: chunk,
        }),
      );
      onProgress(Math.min(n * partSize, file.size));
    }
    return await api<{ trackId: string; title: string; size: number }>(
      `/api/studio/uploads/${uploadId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      },
    );
  } catch (error) {
    await fetch(`/api/studio/uploads/${uploadId}`, { method: "DELETE" }).catch(
      () => {},
    );
    throw error;
  }
}

export function Uploader({
  canUpload,
  initialTracks,
  usedBytes,
  quotaBytes,
}: {
  canUpload: boolean;
  initialTracks: Track[];
  usedBytes: number;
  quotaBytes: number;
}) {
  const t = useT().studio;
  const locale = useLocale();
  const gb = (bytes: number) => formatNumber(locale, bytes / 1024 ** 3, 2);
  const mb = (bytes: number) => formatNumber(locale, bytes / 1024 ** 2, 1);
  const [tracks, setTracks] = useState(initialTracks);
  const [used, setUsed] = useState(usedBytes);
  const [progress, setProgress] = useState<Progress[]>([]);
  const busy = progress.some((p) => p.sent < p.total && !p.error);

  async function handleFiles(files: File[]) {
    setProgress(files.map((f) => ({ name: f.name, sent: 0, total: f.size })));
    for (const [i, file] of files.entries()) {
      const update = (patch: Partial<Progress>) =>
        setProgress((all) =>
          all.map((p, j) => (j === i ? { ...p, ...patch } : p)),
        );
      try {
        const track = await uploadFile(file, (sent) => update({ sent }));
        setTracks((all) => [
          ...all,
          { id: track.trackId, title: track.title, size_bytes: track.size },
        ]);
        setUsed((u) => u + track.size);
        update({ sent: file.size });
      } catch (error) {
        update({ error: error instanceof Error ? error.message : t.error });
      }
    }
  }

  async function remove(track: Track) {
    if (!window.confirm(t.confirmDelete(track.title))) return;
    await api(`/api/studio/tracks/${track.id}`, { method: "DELETE" });
    setTracks((all) => all.filter((t) => t.id !== track.id));
    setUsed((u) => u - track.size_bytes);
  }

  return (
    <div>
      <label
        aria-disabled={!canUpload || busy}
        className={`block rounded-xl border-2 border-dashed border-fern dark:border-slate/40 bg-sage dark:bg-ink p-10 text-center ${canUpload && !busy ? "cursor-pointer hover:border-pine dark:hover:border-clay focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pine dark:focus-within:outline-clay" : "cursor-not-allowed opacity-60"}`}
      >
        <input
          className="sr-only"
          type="file"
          accept="audio/*"
          multiple
          disabled={!canUpload || busy}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void handleFiles(files);
          }}
        />
        <span aria-hidden="true" className="text-4xl">
          ↑
        </span>
        <strong className="mt-4 block">
          {canUpload ? t.upload : t.activatePlan}
        </strong>
        <span className="mt-2 block text-sm text-moss dark:text-stone">
          {t.usage(gb(used), gb(quotaBytes))}
        </span>
      </label>

      {progress.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm" aria-live="polite">
          {progress.map((p) => (
            <li key={p.name}>
              <div className="flex justify-between gap-4">
                <span className="truncate">{p.name}</span>
                <span
                  className={
                    p.error
                      ? "text-red-700 dark:text-coral"
                      : "text-moss dark:text-stone"
                  }
                >
                  {p.error ??
                    (p.sent >= p.total
                      ? t.done
                      : `${Math.round((p.sent / p.total) * 100)} %`)}
                </span>
              </div>
              <progress className="mt-1 w-full" max={p.total} value={p.sent} />
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8 rounded-xl border border-sand dark:border-slate/40 bg-white/40 dark:bg-white/5 p-7">
        <h2 className="text-xl font-bold">{t.tracksTitle}</h2>
        {tracks.length === 0 ? (
          <p className="mt-5 text-moss dark:text-stone">{t.noTracks}</p>
        ) : (
          <ul className="mt-5 divide-y divide-sand dark:divide-slate/40">
            {tracks.map((track) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="truncate">{track.title}</span>
                <span className="flex shrink-0 items-center gap-4 text-sm text-moss dark:text-stone">
                  {mb(track.size_bytes)} MB
                  <button onClick={() => remove(track)} className="underline">
                    {t.delete}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
