import Link from "next/link";
import { notFound } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { RoomPlayer } from "@/components/RoomPlayer";
import { ChatBox } from "@/components/room/ChatBox";
import { RoomView } from "@/components/room/RoomView";
import { SubscribeButton } from "@/components/SubscribeButton";
import { getBandBySlug, hasAccess } from "@/lib/access";
import { demoMembershipEnabled } from "@/lib/demo";
import { bookletHasContent, listAlbums, listBooklets } from "@/lib/albums";
import { getBandState } from "@/lib/billing";
import { getChatViewer, listChat } from "@/lib/chat";
import { chatLimit } from "@/lib/chat-rules";
import { getT } from "@/lib/i18n/server";
import { getRoomProfile } from "@/lib/room-profile";
import { BOX_EFFECTS } from "@/lib/room-theme";
import { getCurrentUser, paymentProvider } from "@/lib/session";
import { listTracks } from "@/lib/tracks";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  /** From search: ?album=<id> or ?track=<id> opens the player on it. */
  searchParams: Promise<{
    album?: string | string[];
    track?: string | string[];
    /** How many chat threads to show ("Load older"). */
    chat?: string | string[];
  }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const band = await getBandBySlug(slug);
  if (!band) notFound();

  const [user, tracks, albums, booklets, profile, { room: t, chat: chatT }] =
    await Promise.all([
      getCurrentUser(),
      listTracks(band.id),
      listAlbums(band.id),
      listBooklets(band.id),
      getRoomProfile(band.id),
      getT(),
    ]);
  const canPlay = await hasAccess(user?.id, band);

  // Only cue albums and songs that are actually in this room.
  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const playable = new Set(tracks.map((tr) => tr.id));
  const playerAlbums = albums
    .map((a) => ({
      ...a,
      // Songs an admin switched off are not in `tracks`; leave them out here.
      trackIds: a.trackIds.filter((id) => playable.has(id)),
    }))
    .filter((a) => a.trackIds.length > 0);
  const cueAlbum = playerAlbums.find((a) => a.id === first(query.album))?.id;
  const cueTrack = tracks.find((tr) => tr.id === first(query.track))?.id;
  const isOwner = Boolean(user && band.owner_id === user.id);

  // A band that stopped paying for over a month: the room is closed to
  // everyone but the band itself (who sees it to fix things in the studio).
  if (
    !isOwner &&
    (band.disabled_at || (await getBandState(band.id)) === "closed")
  )
    return (
      <main className="min-h-screen bg-paper dark:bg-night">
        <Navigation />
        <section className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="serif text-5xl tracking-[-.06em]">{band.name}</h1>
          <p className="mt-6 leading-relaxed text-moss dark:text-stone">
            {band.disabled_at ? t.disabled : t.closed}
          </p>
          <Link href="/" className="mt-8 inline-block font-bold underline">
            {t.closedBack}
          </Link>
        </section>
      </main>
    );

  // The chat: members and the band read and write; everyone else is told it
  // is for members.
  const chatViewer = await getChatViewer(user, band);
  const chatLimitNow = chatLimit(
    Array.isArray(query.chat) ? query.chat[0] : query.chat,
  );
  const chat = chatViewer
    ? await listChat(band, chatViewer, "Fan", chatLimitNow)
    : { threads: [], hasMore: false };

  return (
    <main className="min-h-screen">
      <RoomView
        name={band.name}
        profile={profile}
        t={t}
        nav={<Navigation themed />}
        player={
          <RoomPlayer
            // A new search hit in the same room starts the player fresh.
            key={`${cueAlbum ?? ""}:${cueTrack ?? ""}`}
            tracks={tracks.map(({ id, title }) => ({ id, title }))}
            initialAlbumId={cueAlbum}
            initialTrackId={cueTrack}
            albums={playerAlbums.map((a) => ({
              ...a,
              hasBooklet: bookletHasContent(booklets[a.id]),
              // The booklet itself is only sent to members and the band.
              booklet: canPlay ? booklets[a.id] : undefined,
            }))}
            canPlay={canPlay}
            autoplay={profile.theme.autoplay}
          />
        }
        chat={
          chatViewer ? (
            <ChatBox
              slug={slug}
              threads={chat.threads}
              moreHref={
                chat.hasMore
                  ? `/room/${encodeURIComponent(slug)}?chat=${chatLimitNow + 50}#chat`
                  : null
              }
              role={chatViewer.role}
              blocked={chatViewer.blocked}
            />
          ) : (
            <p className="opacity-90">{chatT.locked}</p>
          )
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
                provider={user ? paymentProvider(user) : "vipps"}
              />
            )}
            <p className="mt-6 text-xs opacity-80">
              <Link
                className="underline"
                href={`/rapporter?rom=${encodeURIComponent(slug)}`}
              >
                {t.report}
              </Link>
            </p>
          </>
        }
      />
    </main>
  );
}
