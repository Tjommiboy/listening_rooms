import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { SAMPLE_ROOM_SLUG } from "@/lib/rooms";

export default function Home() {
  return (
    <main className="min-h-screen bg-night text-cream">
      <Navigation dark />
      <section className="mx-auto max-w-6xl px-5 pb-28 pt-24 md:pb-44 md:pt-40">
        <p className="text-xs font-bold tracking-[0.16em] text-clay">
          AN INDEPENDENT MUSIC SPACE
        </p>
        <h1 className="serif mt-5 max-w-4xl text-6xl leading-[.86] tracking-[-0.08em] md:text-9xl">
          Music made
          <br />
          for close listening.
        </h1>
        <p className="mt-8 max-w-lg text-lg leading-relaxed text-stone">
          Listening Rooms gives independent artists a private place for
          unreleased music, demos, live recordings, and their closest
          supporters.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={`/room/${SAMPLE_ROOM_SLUG}`}
            className="bg-clay px-5 py-3 font-bold text-ink"
          >
            Explore a room →
          </Link>
          <Link
            href="/artists"
            className="border border-slate px-5 py-3 font-bold"
          >
            Create your room
          </Link>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl border-y border-slate/40 md:grid-cols-3">
        {[
          [
            "01",
            "Direct support",
            "Fans subscribe to an artist, not a giant catalogue.",
          ],
          [
            "02",
            "Private releases",
            "Share the material that does not belong on Spotify.",
          ],
          [
            "03",
            "Artist-owned space",
            "Set your price, build your archive, and keep the connection personal.",
          ],
        ].map(([number, title, text]) => (
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
    </main>
  );
}
