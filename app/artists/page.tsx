import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import {
  ARTIST_PLAN_PRICE_KR,
  ARTIST_STORAGE_GB,
  PLATFORM_FEE_PERCENT,
} from "@/lib/pricing";

const steps = [
  ["01", "Build your room", "Choose your artist name, look, and member price."],
  [
    "02",
    "Upload your work",
    "Store recordings privately and select what members can hear.",
  ],
  [
    "03",
    "Get supported",
    "Fans subscribe directly to you and payouts reach your bank.",
  ],
];

export default function ArtistsPage() {
  return (
    <main className="min-h-screen bg-paper">
      <Navigation />
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-40">
        <p className="text-xs font-bold tracking-[0.16em] text-pine">
          FOR INDEPENDENT ARTISTS
        </p>
        <h1 className="serif mt-5 text-6xl leading-[.86] tracking-[-.08em] md:text-8xl">
          Your own room.
          <br />
          Your own audience.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-moss">
          A direct-to-fan home for music that goes deeper than a public release.
        </p>
        <Link
          href="/studio"
          className="mt-8 inline-block bg-ink px-5 py-3 font-bold text-paper"
        >
          Start your room →
        </Link>
      </section>
      <section className="mx-auto grid max-w-6xl bg-ink text-paper md:grid-cols-3">
        {steps.map(([number, title, text]) => (
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
          <p className="text-xs font-bold tracking-[.16em] text-pine">
            SIMPLE, TRANSPARENT PRICING
          </p>
          <h2 className="serif mt-4 text-5xl leading-none tracking-[-.07em] md:text-7xl">
            Built to keep artists in control.
          </h2>
          <p className="mt-6 max-w-lg leading-relaxed text-moss">
            Artists pay for their storage; the platform only earns when an
            artist earns from a fan subscription.
          </p>
        </div>
        <article className="rounded-lg bg-sage p-8">
          <p className="text-xs font-bold tracking-[.16em] text-pine">
            ARTIST STORAGE
          </p>
          <p className="mt-7 flex items-center gap-3">
            <strong className="serif text-7xl font-normal tracking-[-.08em]">
              {ARTIST_PLAN_PRICE_KR}
            </strong>
            <span className="text-moss">
              kr
              <br />
              per month
            </span>
          </p>
          <ul className="mt-7 border-t border-fern">
            {[
              `${ARTIST_STORAGE_GB} GB private music storage`,
              "Your own artist Listening Room",
              "Subscriber-only releases",
              "Stripe payout onboarding",
              `${PLATFORM_FEE_PERCENT}% platform fee on fan subscriptions`,
            ].map((item) => (
              <li key={item} className="border-b border-fern py-3">
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/studio"
            className="mt-6 flex justify-between bg-ink px-5 py-3 font-bold text-paper"
          >
            Request artist access <span>→</span>
          </Link>
          <p className="mt-4 text-center text-xs text-moss">
            Payment processing fees are deducted before artist payout.
          </p>
        </article>
      </section>
    </main>
  );
}
