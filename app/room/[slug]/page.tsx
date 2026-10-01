import Link from "next/link";
import { notFound } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { RoomPlayer } from "@/components/RoomPlayer";
import { getRoom, getRoomSlugs } from "@/lib/rooms";

export const dynamicParams = false;

export function generateStaticParams() {
  return getRoomSlugs().map((slug) => ({ slug }));
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = getRoom(slug);
  if (!room) notFound();

  return (
    <main className="min-h-screen bg-paper">
      <Navigation />
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pt-24">
        <p className="text-xs font-bold tracking-[.16em] text-pine">
          ARTIST LISTENING ROOM
        </p>
        <h1 className="serif mt-4 text-6xl tracking-[-.08em] md:text-8xl">
          {room.name}&apos;s room.
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-moss">
          A small private archive of demos, live sessions, and recordings made
          for close listeners.
        </p>
      </section>
      <div className="mx-auto max-w-6xl px-5">
        <RoomPlayer tracks={room.tracks} />
      </div>
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-20 md:grid-cols-[1fr_330px]">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-pine">
            IN THIS ROOM
          </p>
          <h2 className="serif mt-3 text-5xl tracking-[-.07em]">
            Beyond the release.
          </h2>
          <p className="mt-5 max-w-xl leading-relaxed text-moss">
            Membership makes space for the unfinished, the intimate, and the
            recordings that never needed to fit a public-release cycle.
          </p>
        </div>
        <aside className="rounded-lg border border-sand bg-white/40 p-7">
          <p className="text-xs font-bold tracking-[.16em] text-pine">
            MEMBERSHIP
          </p>
          <p className="mt-5 text-4xl font-bold">
            {room.memberPriceKr} kr
            <span className="text-base font-normal text-moss"> / month</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-moss">
            Full access to this artist&apos;s private recordings. Cancel
            anytime.
          </p>
          <button
            disabled
            className="mt-6 w-full bg-ink py-3 font-bold text-paper disabled:cursor-not-allowed disabled:opacity-60"
          >
            Memberships open soon
          </button>
        </aside>
      </section>
      <p className="mx-auto max-w-6xl px-5 pb-10 text-sm text-moss">
        Demo route:{" "}
        <Link className="underline" href="/artists">
          create an artist room
        </Link>
        .
      </p>
    </main>
  );
}
