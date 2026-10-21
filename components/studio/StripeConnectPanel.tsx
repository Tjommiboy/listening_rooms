"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";

/** Lets a band connect its own Stripe account for card payments from abroad. */
export function StripeConnectPanel({
  connected,
  ready,
}: {
  connected: boolean;
  ready: boolean;
}) {
  const all = useT();
  const t = all.stripe;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/connect", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url)
        throw new Error(data.error ?? all.subscribe.generic);
      window.location.assign(data.url);
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : all.subscribe.generic);
    }
  }

  return (
    <section className="mt-8 max-w-xl rounded-xl border border-sand bg-white/40 p-6 dark:border-slate/40 dark:bg-white/5">
      <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
        {t.connectEyebrow}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-moss dark:text-stone">
        {t.connectText}
      </p>
      {ready ? (
        <p className="mt-4 font-bold">✓ {t.ready}</p>
      ) : (
        <>
          {connected && (
            <p className="mt-3 text-sm text-moss dark:text-stone">
              {t.pending}
            </p>
          )}
          <button
            onClick={start}
            disabled={loading}
            className="mt-4 bg-[#4f3ad6] px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {connected ? t.continue : t.connect}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-coral">
          {error}
        </p>
      )}
    </section>
  );
}
