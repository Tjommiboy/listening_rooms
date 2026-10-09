import Link from "next/link";
import { redirect } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { RoomEditor } from "@/components/studio/RoomEditor";
import { getBandByOwner } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import { getRoomProfile, getThemeBanks } from "@/lib/room-profile";
import { getCurrentUser } from "@/lib/session";
import { listTracks } from "@/lib/tracks";

// Studio → "Customize room": a MySpace-style editor with live preview.
export default async function CustomizeRoomPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/logg-inn?next=/studio/rom");
  const band = await getBandByOwner(user.id);
  if (!band) redirect("/studio");

  const [profile, banks, tracks, { editor: t }] = await Promise.all([
    getRoomProfile(band.id),
    getThemeBanks(band.id),
    listTracks(band.id),
    getT(),
  ]);

  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-[1400px] px-5 pb-16 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/studio" className="text-sm font-bold underline">
              {t.back}
            </Link>
            <p className="mt-6 text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
              {t.eyebrow}
            </p>
            <h1 className="serif mt-3 text-5xl tracking-[-.07em]">{t.title}</h1>
            <p className="mt-3 max-w-xl leading-relaxed text-moss dark:text-stone">
              {t.intro}
            </p>
          </div>
          <Link
            href={`/room/${band.slug}`}
            className="border border-current px-4 py-2 text-sm font-bold"
          >
            {t.viewRoom} →
          </Link>
        </div>
        <RoomEditor
          bandName={band.name}
          memberPriceKr={band.member_price_kr}
          initial={profile}
          initialBanks={banks}
          tracks={tracks.map(({ id, title }) => ({ id, title }))}
        />
      </section>
    </main>
  );
}
