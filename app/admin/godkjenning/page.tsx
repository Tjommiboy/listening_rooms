import Link from "next/link";
import { notFound } from "next/navigation";
import { GoLiveActions } from "@/components/GoLiveActions";
import { Navigation } from "@/components/Navigation";
import { isAdmin } from "@/lib/admin";
import { getLocale, getT } from "@/lib/i18n/server";
import { listGoLiveCandidates } from "@/lib/payout";
import { formatOrgNumber } from "@/lib/payout-rules";
import { getCurrentUser } from "@/lib/session";

// Platform admins only: approve bands to go live (manual in beta).
export default async function GoLivePage() {
  if (!isAdmin(await getCurrentUser())) notFound();
  const [locale, { goLive: t }, bands] = await Promise.all([
    getLocale(),
    getT(),
    listGoLiveCandidates(),
  ]);
  const date = new Intl.DateTimeFormat(locale === "nb" ? "nb-NO" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/Oslo",
  });

  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-4xl px-5 pb-24 pt-12">
        <Link href="/admin/rapporter" className="text-sm font-bold underline">
          {t.reportsLink}
        </Link>
        <p className="mt-6 text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
          {t.eyebrow}
        </p>
        <h1 className="serif mt-4 text-5xl tracking-[-.08em]">{t.title}</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-moss dark:text-stone">
          {t.intro}
        </p>
        {bands.length === 0 ? (
          <p className="mt-8 text-moss dark:text-stone">{t.none}</p>
        ) : (
          <ul className="mt-8 space-y-4">
            {bands.map((b) => (
              <li
                key={b.id}
                className="rounded-xl border border-sand bg-white/40 p-6 dark:border-slate/40 dark:bg-white/5"
              >
                <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Link
                    href={`/room/${b.slug}`}
                    className="text-lg font-bold underline"
                  >
                    {b.name}
                  </Link>
                  {b.approvedAt && (
                    <span className="text-sm font-bold text-pine dark:text-clay">
                      {t.approvedAt(date.format(b.approvedAt))}
                    </span>
                  )}
                  {b.disabled && (
                    <span className="text-sm font-bold text-red-700 dark:text-coral">
                      {t.disabled}
                    </span>
                  )}
                </p>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-moss dark:text-stone">{t.org}</dt>
                  <dd>
                    {b.orgNumber
                      ? `${formatOrgNumber(b.orgNumber)}${b.orgName ? ` · ${b.orgName}` : ""}`
                      : "–"}
                  </dd>
                  <dt className="text-moss dark:text-stone">{t.vipps}</dt>
                  <dd>
                    {b.vippsMsn ? t.msn(b.vippsMsn) : (b.vippsStatus ?? "–")}
                  </dd>
                  <dt className="text-moss dark:text-stone">{t.stripe}</dt>
                  <dd>{b.stripeReady ? t.yes : t.no}</dd>
                  <dt className="text-moss dark:text-stone">{t.plan}</dt>
                  <dd>{b.planPaid ? t.paid : t.unpaid}</dd>
                </dl>
                <GoLiveActions
                  bandId={b.id}
                  approved={b.approvedAt !== null}
                  canApprove={Boolean(b.vippsMsn) || b.stripeReady}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
