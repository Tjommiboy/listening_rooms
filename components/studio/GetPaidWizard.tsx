"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import type { PayoutView } from "@/lib/payout";
import {
  formatOrgNumber,
  namesMatch,
  type StepState,
} from "@/lib/payout-rules";

const ALTINN_URL =
  "https://info.altinn.no/en/forms-overview/bronnoysund-register-centre/coordinated-register-notification--registering-a-new-entity-or-changing-information-regarding-an-existing-entity-";

const input =
  "mt-2 w-full max-w-xs rounded border border-sand bg-white px-3 py-2 text-ink dark:border-slate/40";
const primary =
  "min-h-11 bg-ink px-5 font-bold text-cream disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cream dark:text-ink";
const secondary =
  "min-h-11 border border-current px-4 text-sm font-bold disabled:opacity-50";

type Busy = "" | "org" | "bank" | "vipps" | "refresh";

/** The "Get paid" wizard for bands in Norway: org number → bank → Vipps → approval. */
export function GetPaidWizard({
  initial,
  userName,
}: {
  initial: PayoutView;
  userName: string | null;
}) {
  const all = useT();
  const t = all.payout;
  const [view, setView] = useState(initial);
  const [orgInput, setOrgInput] = useState("");
  const [bankInput, setBankInput] = useState("");
  const [editOrg, setEditOrg] = useState(!initial.org);
  const [editBank, setEditBank] = useState(!initial.bankAccountLast5);
  const [busy, setBusy] = useState<Busy>("");
  const [error, setError] = useState<{ step: Busy; text: string } | null>(
    null,
  );

  async function call(step: Busy, init?: RequestInit) {
    setBusy(step);
    setError(null);
    try {
      const response = await fetch("/api/studio/payout", init);
      const data = (await response.json().catch(() => ({}))) as {
        view?: PayoutView;
        url?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? t.failed);
      return data;
    } catch (e) {
      setError({ step, text: e instanceof Error ? e.message : t.failed });
      return null;
    } finally {
      setBusy("");
    }
  }

  function post(step: Busy, body: object) {
    return call(step, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault();
    const data = await post("org", { action: "org", value: orgInput });
    if (data?.view) {
      setView(data.view);
      setEditOrg(false);
      setOrgInput("");
    } else {
      // An org Brønnøysund won't accept (e.g. bankrupt) is still saved, so
      // show it with the reason. Keeps the error message on screen.
      const fresh = await fetch("/api/studio/payout")
        .then((r) => r.json() as Promise<{ view?: PayoutView | null }>)
        .catch(() => null);
      if (fresh?.view?.org) {
        setView(fresh.view);
        setEditOrg(false);
      }
    }
  }

  async function saveBank(e: React.FormEvent) {
    e.preventDefault();
    const data = await post("bank", { action: "bank", value: bankInput });
    if (data?.view) {
      setView(data.view);
      setEditBank(false);
      setBankInput("");
    }
  }

  async function startVipps() {
    const data = await post("vipps", { action: "vipps" });
    if (data?.url) window.location.assign(data.url);
  }

  async function refresh() {
    const data = await call("refresh");
    if (data?.view) setView(data.view);
  }

  const { steps, org, vipps } = view;
  const showNameWarning = Boolean(
    org && !org.problem && !namesMatch(userName, org.ownerName),
  );
  const errorFor = (step: Busy) =>
    error?.step === step ? (
      <p role="alert" className="mt-3 text-sm text-red-700 dark:text-coral">
        {error.text}
      </p>
    ) : null;
  const vippsOpen =
    vipps.status === "RECEIVED" || vipps.status === "MERCHANT_VIEWED";
  const canStartVipps =
    steps.org === "done" &&
    steps.bank === "done" &&
    view.partnerReady &&
    !vipps.msn &&
    vipps.status !== "ORDER_SUBMITTED";

  return (
    <div className="mt-10 max-w-2xl">
      {view.fake && (
        <p className="mb-6 text-sm font-bold text-pine dark:text-clay">
          {t.fakeNote}
        </p>
      )}
      <ol className="space-y-6">
        <Step n={1} title={t.steps.org} state={steps.org}>
          <p className="text-sm leading-relaxed text-moss dark:text-stone">
            {t.org.intro}
          </p>
          {org && (
            <div className="mt-4 text-sm">
              <p className="font-bold">{formatOrgNumber(org.number)}</p>
              {org.problem ? (
                <p className="mt-1 text-red-700 dark:text-coral">
                  {t.org.problems[org.problem]}
                </p>
              ) : (
                <>
                  <p className="mt-1">{t.org.found(org.name, org.form)}</p>
                  {org.ownerName && (
                    <p className="mt-1 text-moss dark:text-stone">
                      {t.org.owner(org.ownerName)}
                    </p>
                  )}
                </>
              )}
              {showNameWarning && (
                <p className="mt-2 text-sm font-bold">{t.org.nameWarning}</p>
              )}
              {!editOrg && view.canEdit && (
                <button
                  onClick={() => setEditOrg(true)}
                  className="mt-3 text-sm font-bold underline"
                >
                  {t.org.change}
                </button>
              )}
            </div>
          )}
          {editOrg && view.canEdit && (
            <form onSubmit={saveOrg} className="mt-4">
              <label className="block text-sm font-bold">
                {t.org.label}
                <input
                  value={orgInput}
                  onChange={(e) => setOrgInput(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={15}
                  className={input}
                />
              </label>
              <button
                type="submit"
                disabled={busy !== "" || orgInput.trim() === ""}
                className={`mt-3 ${primary}`}
              >
                {busy === "org" ? t.org.checking : t.org.check}
              </button>
            </form>
          )}
          {errorFor("org")}
          {steps.org !== "done" && (
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer font-bold">
                {t.org.noneTitle}
              </summary>
              <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed">
                {t.org.noneSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <a
                href={ALTINN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block font-bold underline"
              >
                {t.org.altinnLink} ↗
              </a>
              <p className="mt-3 text-moss dark:text-stone">{t.org.vatNote}</p>
            </details>
          )}
        </Step>

        <Step n={2} title={t.steps.bank} state={steps.bank}>
          <p className="text-sm leading-relaxed text-moss dark:text-stone">
            {t.bank.intro}
          </p>
          {view.bankAccountLast5 && !editBank && (
            <p className="mt-4 text-sm font-bold">
              {t.bank.saved(view.bankAccountLast5)}
              {view.canEdit && (
                <button
                  onClick={() => setEditBank(true)}
                  className="ml-3 font-bold underline"
                >
                  {t.bank.change}
                </button>
              )}
            </p>
          )}
          {editBank && view.canEdit && (
            <form onSubmit={saveBank} className="mt-4">
              <label className="block text-sm font-bold">
                {t.bank.label}
                <input
                  value={bankInput}
                  onChange={(e) => setBankInput(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={20}
                  className={input}
                />
              </label>
              <button
                type="submit"
                disabled={busy !== "" || bankInput.trim() === ""}
                className={`mt-3 ${primary}`}
              >
                {busy === "bank" ? t.bank.saving : t.bank.save}
              </button>
            </form>
          )}
          {view.canEdit && (org || view.bankAccountLast5) && vipps.status && (
            <p className="mt-3 text-xs text-moss dark:text-stone">
              {t.bank.changeNote}
            </p>
          )}
          {errorFor("bank")}
        </Step>

        <Step n={3} title={t.steps.vipps} state={steps.vipps}>
          <p className="text-sm leading-relaxed text-moss dark:text-stone">
            {t.vipps.intro}
          </p>
          {vipps.status && (
            <p className="mt-4 text-sm font-bold" aria-live="polite">
              {t.vipps.status[vipps.status]}
            </p>
          )}
          {vipps.msn && (
            <p className="mt-1 text-sm text-moss dark:text-stone">
              {t.vipps.msn(vipps.msn)}
            </p>
          )}
          {!view.canEdit && !vipps.msn && (
            <p className="mt-2 text-xs text-moss dark:text-stone">
              {t.vipps.lockedNote}
            </p>
          )}
          {!vipps.msn &&
            (steps.org !== "done" || steps.bank !== "done") && (
              <p className="mt-4 text-sm">{t.vipps.needsEarlier}</p>
            )}
          {!view.partnerReady && !vipps.msn && (
            <p className="mt-4 text-sm">{t.vipps.notReady}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canStartVipps && (
              <button
                onClick={startVipps}
                disabled={busy !== ""}
                className="min-h-11 bg-[#ff5b24] px-5 font-bold text-white disabled:opacity-60"
              >
                {busy === "vipps"
                  ? t.vipps.starting
                  : vippsOpen && vipps.url
                    ? t.vipps.continue
                    : vipps.status === "REJECTED" || vipps.status === "EXPIRED"
                      ? t.vipps.again
                      : t.vipps.start}
              </button>
            )}
            {vipps.status && !vipps.msn && vipps.status !== "EXPIRED" && (
              <button
                onClick={refresh}
                disabled={busy !== ""}
                className={secondary}
              >
                {t.vipps.refresh}
              </button>
            )}
          </div>
          {canStartVipps && (
            <p className="mt-2 text-xs text-moss dark:text-stone">
              {t.vipps.expiresNote}
            </p>
          )}
          {errorFor("vipps")}
          {errorFor("refresh")}
        </Step>

        <Step n={4} title={t.steps.live} state={steps.live}>
          <p className="text-sm leading-relaxed">
            {steps.live === "done"
              ? t.live.done
              : steps.live === "waiting"
                ? t.live.waiting
                : t.live.todo}
          </p>
        </Step>
      </ol>
    </div>
  );
}

function Step({
  n,
  title,
  state,
  children,
}: {
  n: number;
  title: string;
  state: StepState;
  children: React.ReactNode;
}) {
  const t = useT().payout;
  const badge =
    state === "done"
      ? `✓ ${t.done}`
      : state === "waiting"
        ? t.waiting
        : state === "problem"
          ? t.problem
          : null;
  return (
    <li className="rounded-xl border border-sand bg-white/40 p-6 dark:border-slate/40 dark:bg-white/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">
          <span className="mr-2 text-sm font-bold tracking-[.12em] text-pine dark:text-clay">
            {t.stepLabel(n)}
          </span>
          {title}
        </h2>
        {badge && (
          <span
            className={`text-sm font-bold ${
              state === "problem"
                ? "text-red-700 dark:text-coral"
                : "text-moss dark:text-stone"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </li>
  );
}
