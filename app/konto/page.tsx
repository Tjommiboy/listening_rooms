import Link from "next/link";
import { redirect } from "next/navigation";
import { CancelSubscriptionButton } from "@/components/CancelSubscriptionButton";
import { Navigation } from "@/components/Navigation";
import {
  listFanPayments,
  listFanSubscriptions,
  type FanSubscription,
} from "@/lib/fan";
import { formatNumber, type Dictionary } from "@/lib/i18n/dictionaries";
import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

// The fan's own page: who they are, which rooms they pay for, what they have
// paid, and cancelling. Needs a login.
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/logg-inn?next=/konto");
  const [locale, all, subscriptions, payments] = await Promise.all([
    getLocale(),
    getT(),
    listFanSubscriptions(user.id),
    listFanPayments(user.id),
  ]);
  const t = all.fan;

  const dateFormat = new Intl.DateTimeFormat(
    locale === "nb" ? "nb-NO" : "en-GB",
    { dateStyle: "long", timeZone: "Europe/Oslo" },
  );
  const date = (ms: number) => dateFormat.format(ms);
  const kr = (ore: number) =>
    formatNumber(locale, ore / 100, ore % 100 === 0 ? 0 : 2);

  const current = subscriptions.filter((s) => s.state !== "ended");
  const previous = subscriptions.filter((s) => s.state === "ended");

  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-3xl px-5 pb-24 pt-12 md:pt-20">
        <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
          {t.eyebrow}
        </p>
        <h1 className="serif mt-4 text-5xl tracking-[-.08em] md:text-7xl">
          {t.title}
        </h1>

        <h2 className="mt-14 text-2xl font-bold">{t.subscriptions}</h2>
        {current.length === 0 ? (
          <p className="mt-4 text-moss dark:text-stone">
            {t.empty}{" "}
            <Link href="/oppdag" className="font-bold underline">
              {t.findRoom}
            </Link>
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-sand border-y border-sand dark:divide-slate/40 dark:border-slate/40">
            {current.map((s) => (
              <SubscriptionRow key={s.id} s={s} t={t} kr={kr} date={date} />
            ))}
          </ul>
        )}

        {previous.length > 0 && (
          <>
            <h2 className="mt-14 text-2xl font-bold">{t.previous}</h2>
            <ul className="mt-6 divide-y divide-sand border-y border-sand dark:divide-slate/40 dark:border-slate/40">
              {previous.map((s) => (
                <SubscriptionRow key={s.id} s={s} t={t} kr={kr} date={date} />
              ))}
            </ul>
          </>
        )}

        <h2 className="mt-14 text-2xl font-bold">{t.history}</h2>
        {payments.length === 0 ? (
          <p className="mt-4 text-moss dark:text-stone">{t.historyEmpty}</p>
        ) : (
          <table className="mt-6 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[.12em] text-moss dark:text-stone">
              <tr>
                <th scope="col" className="py-2 pr-4 font-bold">
                  {t.colDate}
                </th>
                <th scope="col" className="py-2 pr-4 font-bold">
                  {t.colRoom}
                </th>
                <th scope="col" className="py-2 text-right font-bold">
                  {t.colAmount}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand dark:divide-slate/40">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 pr-4">
                    <time dateTime={new Date(p.capturedAt).toISOString()}>
                      {date(p.capturedAt)}
                    </time>
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/room/${p.bandSlug}`}
                      className="font-bold hover:underline"
                    >
                      {p.bandName}
                    </Link>
                  </td>
                  <td className="py-3 text-right">{kr(p.amountOre)} kr</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 className="mt-14 text-2xl font-bold">{t.account}</h2>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-moss dark:text-stone">{t.name}</dt>
          <dd>{user.name ?? t.notGiven}</dd>
          <dt className="text-moss dark:text-stone">{t.email}</dt>
          <dd>{user.email ?? t.notGiven}</dd>
          <dt className="text-moss dark:text-stone">{t.phone}</dt>
          <dd>{user.phone ?? t.notGiven}</dd>
        </dl>
      </section>
    </main>
  );
}

function SubscriptionRow({
  s,
  t,
  kr,
  date,
}: {
  s: FanSubscription;
  t: Dictionary["fan"];
  kr: (ore: number) => string;
  date: (ms: number) => string;
}) {
  const until = s.paidUntil === null ? "" : date(s.paidUntil);
  const status = {
    active: t.states.active(until),
    cancelling: t.states.cancelling(until),
    payment_failed: t.states.paymentFailed,
    room_closed: t.states.roomClosed,
    ended: t.states.ended,
    pending: t.states.pending,
  }[s.state];
  const needsAttention = s.state === "payment_failed";

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 py-6">
      <div className="min-w-0">
        <p className="truncate text-lg font-bold">
          <Link href={`/room/${s.bandSlug}`} className="hover:underline">
            {s.bandName}
          </Link>
        </p>
        <p className="mt-1 text-sm text-moss dark:text-stone">
          {t.perMonth(kr(s.amountOre))} · {t.via[s.provider]}
        </p>
        <p
          className={`mt-2 text-sm ${needsAttention ? "font-bold text-red-700 dark:text-coral" : ""}`}
        >
          {status}
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        {s.state === "active" && (
          <CancelSubscriptionButton agreementId={s.id} accessUntil={until} />
        )}
        {(s.state === "active" || s.state === "cancelling") && (
          <Link
            href={`/room/${s.bandSlug}`}
            className="inline-flex min-h-11 items-center border border-current px-4 text-sm font-bold"
          >
            {t.openRoom}
          </Link>
        )}
        {(s.state === "payment_failed" || s.state === "ended") && (
          <Link
            href={`/room/${s.bandSlug}`}
            className="inline-flex min-h-11 items-center bg-ink px-4 text-sm font-bold text-cream dark:bg-cream dark:text-ink"
          >
            {t.resubscribe}
          </Link>
        )}
      </div>
    </li>
  );
}
