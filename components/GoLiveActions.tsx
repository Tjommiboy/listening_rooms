"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";

/** Approve a band to go live, or withdraw the approval. */
export function GoLiveActions({
  bandId,
  approved,
  canApprove,
}: {
  bandId: string;
  approved: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const t = useT().goLive;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "approve_live" | "revoke_live") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: bandId }),
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
    <div className="mt-4">
      {approved ? (
        <button
          onClick={() => run("revoke_live")}
          disabled={busy}
          className="min-h-11 border border-current px-4 text-sm font-bold disabled:opacity-50"
        >
          {t.revoke}
        </button>
      ) : canApprove ? (
        <button
          onClick={() => run("approve_live")}
          disabled={busy}
          className="min-h-11 bg-ink px-5 text-sm font-bold text-cream disabled:opacity-50 dark:bg-cream dark:text-ink"
        >
          {t.approve}
        </button>
      ) : (
        <p className="text-sm text-moss dark:text-stone">{t.notReady}</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
