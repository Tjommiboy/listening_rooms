import { Navigation } from "@/components/Navigation";
import { getT } from "@/lib/i18n/server";

// Linked from every Vipps agreement (merchantAgreementUrl).
// Draft: have the final terms reviewed before launch.
export default async function TermsPage() {
  const t = (await getT()).terms;
  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-3xl px-5 py-16 leading-relaxed">
        <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
          {t.eyebrow}
        </p>
        <h1 className="serif mt-4 text-5xl tracking-[-.07em]">{t.title}</h1>
        <h2 className="mt-10 text-xl font-bold">{t.payHeading}</h2>
        <p className="mt-3 text-moss dark:text-stone">{t.payText}</p>
        <h2 className="mt-8 text-xl font-bold">{t.cancelHeading}</h2>
        <p className="mt-3 text-moss dark:text-stone">{t.cancelText}</p>
        <h2 className="mt-8 text-xl font-bold">{t.contactHeading}</h2>
        <p className="mt-3 text-moss dark:text-stone">{t.contactText}</p>
      </section>
    </main>
  );
}
