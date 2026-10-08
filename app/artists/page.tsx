import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { getT } from "@/lib/i18n/server";
import { ARTIST_PLAN_PRICE_KR } from "@/lib/pricing";

export default async function ArtistsPage() {
  const t = (await getT()).artists;
  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-40">
        <p className="text-xs font-bold tracking-[0.16em] text-pine dark:text-clay">
          {t.eyebrow}
        </p>
        <h1 className="serif mt-5 text-6xl leading-[.86] tracking-[-.08em] md:text-8xl">
          {t.title1}
          <br />
          {t.title2}
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-moss dark:text-stone">
          {t.intro}
        </p>
        <Link
          href="/studio"
          className="mt-8 inline-block bg-ink px-5 py-3 font-bold text-paper dark:bg-clay dark:text-ink"
        >
          {t.start}
        </Link>
      </section>
      <section className="mx-auto grid max-w-6xl bg-ink text-paper md:grid-cols-3">
        {t.steps.map(([number, title, text]) => (
          <article
            key={number}
            className="border-b border-rule/20 p-9 last:border-0 md:border-b-0 md:border-r md:last:border-0"
          >
            <p className="text-xs font-bold tracking-[.16em] text-mist">
              {number}
            </p>
            <h2 className="mt-12 text-2xl font-bold">{title}</h2>
            <p className="mt-3 leading-relaxed text-fog">{text}</p>
          </article>
        ))}
      </section>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-[1fr_400px] md:items-center">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
            {t.pricingEyebrow}
          </p>
          <h2 className="serif mt-4 text-5xl leading-none tracking-[-.07em] md:text-7xl">
            {t.pricingTitle}
          </h2>
          <p className="mt-6 max-w-lg leading-relaxed text-moss dark:text-stone">
            {t.pricingText}
          </p>
        </div>
        <article className="rounded-lg bg-sage dark:bg-ink p-8">
          <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
            {t.planEyebrow}
          </p>
          <p className="mt-7 flex items-center gap-3">
            <strong className="serif text-7xl font-normal tracking-[-.08em]">
              {ARTIST_PLAN_PRICE_KR}
            </strong>
            <span className="text-moss dark:text-stone">
              {t.perMonth1}
              <br />
              {t.perMonth2}
            </span>
          </p>
          <ul className="mt-7 border-t border-fern dark:border-slate/40">
            {t.planItems.map((item) => (
              <li
                key={item}
                className="border-b border-fern dark:border-slate/40 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/studio"
            className="mt-6 flex justify-between bg-ink px-5 py-3 font-bold text-paper dark:bg-clay dark:text-ink"
          >
            {t.requestAccess} <span>→</span>
          </Link>
          <p className="mt-4 text-center text-xs text-moss dark:text-stone">
            {t.vippsFees}
          </p>
        </article>
      </section>
    </main>
  );
}
