import Link from "next/link";
import { notFound } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { RoomPlayer } from "@/components/RoomPlayer";
import { RoomView } from "@/components/room/RoomView";
import { SubscribeButton } from "@/components/SubscribeButton";
import { getBandBySlug, hasAccess } from "@/lib/access";
import { demoMembershipEnabled } from "@/lib/demo";
import { getT } from "@/lib/i18n/server";
import { getRoomProfile } from "@/lib/room-profile";
import { getCurrentUser } from "@/lib/session";
import { listTracks } from "@/lib/tracks";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const band = await getBandBySlug(slug);
  if (!band) notFound();

  const [user, tracks, profile, { room: t }] = await Promise.all([
    getCurrentUser(),
    listTracks(band.id),
    getRoomProfile(band.id),
    getT(),
  ]);
  const canPlay = await hasAccess(user?.id, band);
  const isOwner = Boolean(user && band.owner_id === user.id);

  return (
    <main className="min-h-screen">
      <RoomView
        name={band.name}
        profile={profile}
        t={t}
        nav={<Navigation themed />}
        player={
          <RoomPlayer
            tracks={tracks.map(({ id, title }) => ({ id, title }))}
            canPlay={canPlay}
            autoplay={profile.theme.autoplay}
          />
        }
        ownerNote={
          isOwner ? (
            <Link
              href="/studio/rom"
              className="block rounded-lg border-2 border-dashed border-[var(--room-accent)] bg-[var(--room-panel)] px-4 py-3 text-center text-sm font-bold backdrop-blur-sm"
            >
              ✎ {t.customize}
            </Link>
          ) : null
        }
        membership={
          <>
            <p className="text-4xl font-bold">
              {band.member_price_kr} kr
              <span className="text-base font-normal opacity-80">
                {" "}
                {t.perMonth}
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed opacity-90">
              {t.membershipText}
            </p>
            {isOwner ? (
              <p className="mt-5 text-sm font-bold">
                {t.yourRoom}{" "}
                <Link className="underline" href="/studio">
                  {t.goToStudio}
                </Link>
              </p>
            ) : (
              <SubscribeButton
                slug={slug}
                signedIn={Boolean(user)}
                hasAccess={canPlay}
                demoMembership={demoMembershipEnabled()}
              />
            )}
          </>
        }
      />
    </main>
  );
}
