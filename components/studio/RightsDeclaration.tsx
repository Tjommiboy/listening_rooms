"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { api } from "@/lib/upload-client";

/** Shown instead of the upload box until the band owner has confirmed. */
export function RightsDeclaration({
  onConfirmed,
}: {
  onConfirmed: () => void;
}) {
  const t = useT().rights;
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await api("/api/studio/rights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept: true }),
      });
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed);
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border-2 border-pine bg-sage p-7 dark:border-clay dark:bg-ink">
      <h2 className="text-xl font-bold">{t.title}</h2>
      <p className="mt-2 text-sm leading-relaxed">{t.intro}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        {t.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <label className="mt-5 flex items-start gap-3 text-sm font-bold">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 size-5 shrink-0"
        />
        {t.checkbox}
      </label>
      <button
        onClick={confirm}
        disabled={!checked || busy}
        className="mt-5 min-h-11 bg-ink px-5 font-bold text-cream disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cream dark:text-ink"
      >
        {busy ? t.saving : t.confirm}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-coral">
          {error}
        </p>
      )}
    </section>
  );
}
