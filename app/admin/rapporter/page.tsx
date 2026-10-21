import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminReportActions } from "@/components/AdminReportActions";
import { Navigation } from "@/components/Navigation";
import { isAdmin } from "@/lib/admin";
import { listReports, tracksOfBands } from "@/lib/content-reports";
import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

// Platform admins only: reports from the public form, with the buttons to
// switch a song or a band off. Everyone else gets a plain 404.
export default async function AdminReportsPage() {
  if (!isAdmin(await getCurrentUser())) notFound();
  const [locale, all, reports] = await Promise.all([
    getLocale(),
    getT(),
    listReports(),
  ]);
  const t = all.admin;
  const tracks = await tracksOfBands([
    ...new Set(reports.flatMap((r) => (r.band ? [r.band.id] : []))),
  ]);
  const when = new Intl.DateTimeFormat(locale === "nb" ? "nb-NO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  });

  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-4xl px-5 pb-24 pt-12">
        <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
          {t.eyebrow}
        </p>
        <h1 className="serif mt-4 text-5xl tracking-[-.08em]">{t.title}</h1>
        {reports.length === 0 ? (
          <p className="mt-8 text-moss dark:text-stone">{t.none}</p>
        ) : (
          <ul className="mt-8 space-y-6">
            {reports.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-sand bg-white/40 p-6 dark:border-slate/40 dark:bg-white/5"
              >
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-[.12em]">
                  <span
                    className={
                      r.status === "open"
                        ? "text-red-700 dark:text-coral"
                        : "text-moss dark:text-stone"
                    }
                  >
                    {r.status === "open" ? t.open : t.handled}
                  </span>
                  <span>{r.category === "rights" ? t.rights : t.other}</span>
                  <span className="font-normal normal-case tracking-normal text-moss dark:text-stone">
                    {t.received} {when.format(r.createdAt)}
                  </span>
                </p>
                <p className="mt-3 text-sm">
                  <span className="text-moss dark:text-stone">{t.room}: </span>
                  {r.band ? (
                    <Link
                      href={`/room/${r.band.slug}`}
                      className="font-bold underline"
                    >
                      {r.band.name}
                    </Link>
                  ) : (
                    <>
                      {r.roomText ?? "-"}{" "}
                      <span className="text-moss dark:text-stone">
                        ({t.roomUnknown})
                      </span>
                    </>
                  )}
                  {r.band?.disabled && (
                    <span className="ml-2 font-bold text-red-700 dark:text-coral">
                      {t.bandDisabled}
                    </span>
                  )}
                </p>
                {(r.track || r.songText) && (
                  <p className="mt-1 text-sm">
                    <span className="text-moss dark:text-stone">
                      {t.song}:{" "}
                    </span>
                    {r.track?.title ?? r.songText}
                  </p>
                )}
                <p className="mt-1 text-sm">
                  <span className="text-moss dark:text-stone">{t.from}: </span>
                  {r.reporterName ?? "-"}
                  {r.reporterEmail && (
                    <>
                      {" "}
                      <a
                        href={`mailto:${r.reporterEmail}`}
                        className="underline"
                      >
                        {r.reporterEmail}
                      </a>
                    </>
                  )}
                </p>
                <p className="mt-4 whitespace-pre-wrap leading-relaxed">
                  {r.description}
                </p>
                {r.status === "handled" && r.handledNote && (
                  <p className="mt-3 text-sm text-moss dark:text-stone">
                    {t.noteLabel}: {r.handledNote}
                  </p>
                )}
                <AdminReportActions
                  reportId={r.id}
                  open={r.status === "open"}
                  bandId={r.band?.id ?? null}
                  bandDisabled={r.band?.disabled ?? false}
                  tracks={r.band ? (tracks.get(r.band.id) ?? []) : []}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
