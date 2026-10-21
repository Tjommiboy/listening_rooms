"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";

type Step = "idle" | "confirm" | "loading" | "error";

/** Two steps, so a misclick can't cancel: "Cancel" → "Yes, cancel". */
export function CancelSubscriptionButton({
  agreementId,
  accessUntil,
}: {
  agreementId: string;
  /** Already formatted for the reader, e.g. "20. november 2026". */
  accessUntil: string;
}) {
  const router = useRouter();
  const t = useT().fan;
  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState("");

  async function cancel() {
    setStep("loading");
    setMessage("");
    try {
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? t.cancelFailed);
      router.refresh();
    } catch (error) {
      setStep("error");
      setMessage(error instanceof Error ? error.message : t.cancelFailed);
    }
  }

  if (step === "idle")
    return (
      <button
        onClick={() => setStep("confirm")}
        className="min-h-11 border border-current px-4 text-sm font-bold"
      >
        {t.cancel}
      </button>
    );

  return (
    <div role="group" aria-label={t.cancelAsk} className="max-w-md">
      <p className="text-sm font-bold">{t.cancelAsk}</p>
      <p className="mt-1 text-sm text-moss dark:text-stone">
        {t.cancelNote(accessUntil)}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          onClick={cancel}
          disabled={step === "loading"}
          className="min-h-11 bg-ink px-4 text-sm font-bold text-cream disabled:opacity-60 dark:bg-cream dark:text-ink"
        >
          {step === "loading" ? t.cancelling : t.cancelYes}
        </button>
        <button
          onClick={() => {
            setStep("idle");
            setMessage("");
          }}
          disabled={step === "loading"}
          className="min-h-11 border border-current px-4 text-sm font-bold disabled:opacity-60"
        >
          {t.cancelNo}
        </button>
      </div>
      {message && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-coral">
          {message}
        </p>
      )}
    </div>
  );
}
