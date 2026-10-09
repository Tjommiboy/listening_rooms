import Link from "next/link";
import { notFound } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { RoomPlayer } from "@/components/RoomPlayer";
import { RoomView } from "@/components/room/RoomView";
import { SubscribeButton } from "@/components/SubscribeButton";
import { getBandBySlug, hasAccess } from "@/lib/access";
import { demoMembershipEnabled } from "@/lib/demo";
import { bookletHasContent, listAlbums, listBooklets } from "@/lib/albums";
import { getT } from "@/lib/i18n/server";
import { getRoomProfile } from "@/lib/room-profile";
import { BOX_EFFECTS } from "@/lib/room-theme";
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

  const [user, tracks, albums, booklets, profile, { room: t }] =
    await Promise.all([
      getCurrentUser(),
      listTracks(band.id),
      listAlbums(band.id),
      listBooklets(band.id),
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
            albums={albums
              .filter((a) => a.trackIds.length > 0)
              .map((a) => ({
                ...a,
                hasBooklet: bookletHasContent(booklets[a.id]),
                // The booklet itself is only sent to members and the band.
                booklet: canPlay ? booklets[a.id] : undefined,
              }))}
            canPlay={canPlay}
            autoplay={profile.theme.autoplay}
          />
        }
        ownerNote={
          isOwner ? (
            <Link
              href="/studio/rom"
              className={`block border-dashed [background:var(--room-panel)] px-4 py-3 text-center text-sm font-bold ${BOX_EFFECTS}`}
              // Always a visible dashed line, whatever the band picks for boxes.
              style={{ borderWidth: 2, borderColor: "var(--room-accent)" }}
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
