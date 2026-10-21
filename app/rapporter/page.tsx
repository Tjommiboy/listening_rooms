import { Navigation } from "@/components/Navigation";
import { ReportForm } from "@/components/ReportForm";
import { getT } from "@/lib/i18n/server";

// Public report form. A room links here with ?rom=<address>; a song can be
// named with ?sang=<track id>.
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ rom?: string; sang?: string }>;
}) {
  const { rom, sang } = await searchParams;
  const t = (await getT()).report;
  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-2xl px-5 pb-24 pt-12 md:pt-20">
        <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
          {t.eyebrow}
        </p>
        <h1 className="serif mt-4 text-5xl tracking-[-.08em] md:text-6xl">
          {t.title}
        </h1>
        <p className="mt-5 leading-relaxed text-moss dark:text-stone">
          {t.intro}
        </p>
        <ReportForm
          defaultRoom={(rom ?? "").slice(0, 200)}
          trackId={(sang ?? "").slice(0, 100) || undefined}
        />
      </section>
    </main>
  );
}
