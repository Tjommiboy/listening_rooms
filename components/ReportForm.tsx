"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { REPORT_LIMITS } from "@/lib/report-rules";

const field =
  "mt-1 w-full rounded border border-sand bg-white px-3 py-2 font-normal text-ink dark:border-slate/40";

export function ReportForm({
  defaultRoom = "",
  trackId,
}: {
  defaultRoom?: string;
  trackId?: string;
}) {
  const t = useT().report;
  const [category, setCategory] = useState("rights");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          room: form.get("room"),
          song: form.get("song"),
          description: form.get("description"),
          name: form.get("name"),
          email: form.get("email"),
          trackId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? t.failed);
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : t.failed);
    }
  }

  if (state === "done")
    return (
      <p role="status" className="mt-8 text-lg font-bold">
        {t.thanks}
      </p>
    );

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <fieldset>
        <legend className="text-sm font-bold">{t.category}</legend>
        {(["rights", "other"] as const).map((value) => (
          <label key={value} className="mt-2 flex items-center gap-3 text-sm">
            <input
              type="radio"
              name="category"
              checked={category === value}
              onChange={() => setCategory(value)}
              className="size-5"
            />
            {t[value]}
          </label>
        ))}
      </fieldset>
      <label className="block text-sm font-bold">
        {t.room}
        <input
          name="room"
          defaultValue={defaultRoom}
          maxLength={REPORT_LIMITS.room}
          className={field}
        />
      </label>
      <label className="block text-sm font-bold">
        {t.song}
        <input name="song" maxLength={REPORT_LIMITS.song} className={field} />
      </label>
      <label className="block text-sm font-bold">
        {t.description}
        <textarea
          name="description"
          required
          rows={6}
          minLength={REPORT_LIMITS.description.min}
          maxLength={REPORT_LIMITS.description.max}
          aria-describedby="report-description-hint"
          className={field}
        />
        <span
          id="report-description-hint"
          className="mt-1 block text-xs font-normal text-moss dark:text-stone"
        >
          {t.descriptionHint}
        </span>
      </label>
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          {t.name}
          <input name="name" maxLength={REPORT_LIMITS.name} className={field} />
        </label>
        <label className="block text-sm font-bold">
          {t.email}
          <input
            name="email"
            type="email"
            maxLength={REPORT_LIMITS.email}
            aria-describedby="report-email-hint"
            className={field}
          />
          <span
            id="report-email-hint"
            className="mt-1 block text-xs font-normal text-moss dark:text-stone"
          >
            {t.emailHint}
          </span>
        </label>
      </div>
      <button
        disabled={state === "sending"}
        className="min-h-11 bg-ink px-6 font-bold text-cream disabled:opacity-60 dark:bg-cream dark:text-ink"
      >
        {state === "sending" ? t.sending : t.submit}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-coral">
          {error}
        </p>
      )}
    </form>
  );
}
