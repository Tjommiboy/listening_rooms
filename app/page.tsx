import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { newSplashSeed, PaintSplash } from "@/components/PaintSplash";
import { PeaceWallpaper } from "@/components/PeaceWallpaper";
import { getT } from "@/lib/i18n/server";
import { SAMPLE_ROOM_SLUG } from "@/lib/rooms";

export default async function Home() {
  const t = (await getT()).home;
  return (
    <main className="relative min-h-screen overflow-hidden bg-night text-cream">
      {/* Tone-on-tone peace wallpaper: only visible if you look for it. */}
      <PeaceWallpaper color="#212c28" background="#1d2825" />
      <div className="relative">
        <Navigation dark />
        <section className="mx-auto max-w-6xl px-5 pb-28 pt-24 md:pb-44 md:pt-40">
          <p className="text-xs font-bold tracking-[0.16em] text-clay">
            {t.eyebrow}
          </p>
          <h1 className="serif mt-5 max-w-4xl text-6xl leading-[.86] tracking-[-0.08em] md:text-9xl">
            {t.title1}
            <br />
            {t.title2}
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-stone">
            {t.intro}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={`/room/${SAMPLE_ROOM_SLUG}`}
              className="bg-clay px-5 py-3 font-bold text-ink"
            >
              {t.explore}
            </Link>
            <span className="text-sm italic text-stone">{t.or}</span>
            <Link
              href="/artists"
              className="relative isolate border border-slate px-5 py-3 font-bold"
            >
              <PaintSplash seed={newSplashSeed()} />
              <span className="relative z-10 text-white">{t.create}</span>
            </Link>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl border-y border-slate/40 md:grid-cols-3">
          {t.features.map(([number, title, text]) => (
            <article
              key={number}
              className="border-slate/40 px-6 py-10 md:border-r md:last:border-0"
            >
              <p className="text-xs font-bold tracking-[0.16em] text-clay">
                {number}
              </p>
              <h2 className="mt-10 text-2xl font-bold">{title}</h2>
              <p className="mt-3 leading-relaxed text-stone">{text}</p>
            </article>
          ))}
        </section>
        <footer className="mx-auto max-w-6xl px-5 py-9 text-sm text-haze">
          © 2026 Listening Rooms
        </footer>
      </div>
    </main>
  );
}
