import type { CSSProperties, ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { RoomProfile } from "@/lib/room-profile";
import { contrastRatio, FONTS, hexToRgba } from "@/lib/room-theme";

/**
 * The band's room, styled entirely from its theme. Used by the public room
 * page and by the live preview in the editor, so what the band sees while
 * editing is exactly what fans get.
 *
 * Everything the band typed is rendered as plain text (React escapes it), and
 * links only ever point to http(s) URLs.
 */
export function RoomView({
  name,
  profile,
  t,
  nav,
  player,
  membership,
  ownerNote,
  fixedBackground = true,
}: {
  name: string;
  profile: RoomProfile;
  t: Dictionary["room"];
  nav?: ReactNode;
  player: ReactNode;
  membership: ReactNode;
  ownerNote?: ReactNode;
  /** The preview scrolls inside a box, where a fixed background looks odd. */
  fixedBackground?: boolean;
}) {
  const { theme } = profile;
  const accentText =
    contrastRatio(theme.accentColor, "#000000") >
    contrastRatio(theme.accentColor, "#ffffff")
      ? "#000000"
      : "#ffffff";

  const style = {
    "--room-bg": theme.bgColor,
    "--room-text": theme.textColor,
    "--room-accent": theme.accentColor,
    "--room-accent-text": accentText,
    "--room-panel": hexToRgba(theme.panelColor, theme.panelOpacity),
    "--room-heading-font": FONTS[theme.headingFont].stack,
    backgroundColor: theme.bgColor,
    color: theme.textColor,
    fontFamily: FONTS[theme.bodyFont].stack,
    ...(profile.backgroundUrl
      ? {
          backgroundImage: `url("${profile.backgroundUrl}")`,
          backgroundRepeat: theme.bgMode === "tile" ? "repeat" : "no-repeat",
          backgroundSize: theme.bgMode === "tile" ? "auto" : "cover",
          backgroundPosition: "center top",
          // Tiles scroll with the page like on MySpace; a full-screen image
          // stays put behind the content.
          backgroundAttachment:
            fixedBackground && theme.bgMode === "cover" ? "fixed" : "scroll",
        }
      : {}),
  } as CSSProperties;

  const heading = { fontFamily: "var(--room-heading-font)" };
  const centered = theme.layout === "centered";

  const avatar = (
    <div className="overflow-hidden rounded-lg border-2 border-[var(--room-accent)] bg-[var(--room-panel)]">
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt={name}
          className="aspect-square w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="grid aspect-square w-full place-items-center text-7xl"
          style={{
            background: `linear-gradient(135deg, ${theme.accentColor}, ${hexToRgba(theme.accentColor, 35)})`,
            color: accentText,
          }}
        >
          ♪
        </div>
      )}
    </div>
  );

  const links =
    profile.links.length > 0 ? (
      <Panel title={t.links} heading={heading}>
        <ul className="space-y-2">
          {profile.links.map((link, index) => (
            <li key={`${index}-${link.url}`}>
              <a
                href={link.url}
                rel="nofollow noopener noreferrer ugc"
                target="_blank"
                className="font-bold underline decoration-[var(--room-accent)] decoration-2 underline-offset-4"
              >
                {link.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    ) : null;

  const about = profile.bio ? (
    <Panel title={t.about} heading={heading}>
      <p className="whitespace-pre-line break-words leading-relaxed">
        {profile.bio}
      </p>
    </Panel>
  ) : null;

  const membershipPanel = (
    <Panel title={t.membershipEyebrow} heading={heading}>
      {membership}
    </Panel>
  );

  return (
    <div style={style} className="min-h-screen">
      {nav && (
        <div className="bg-[var(--room-panel)] backdrop-blur-sm">{nav}</div>
      )}
      <header
        className={`mx-auto max-w-6xl px-5 pb-6 pt-6 md:pt-10 ${centered ? "max-w-2xl text-center" : ""}`}
      >
        <div className="rounded-lg bg-[var(--room-panel)] p-6 backdrop-blur-sm md:p-8">
          <p className="text-xs font-bold tracking-[.16em] text-[var(--room-accent)]">
            {t.eyebrow}
          </p>
          <h1
            style={heading}
            className="mt-3 break-words text-5xl leading-none tracking-[-.03em] md:text-7xl"
          >
            {name}
          </h1>
          {profile.tagline && (
            <p className="mt-4 text-lg opacity-90">{profile.tagline}</p>
          )}
        </div>
      </header>

      {centered ? (
        <div className="mx-auto max-w-2xl space-y-6 px-5 pb-16">
          <div className="mx-auto w-48">{avatar}</div>
          {player}
          {ownerNote}
          {membershipPanel}
          {about}
          {links}
        </div>
      ) : (
        // Two columns on desktop. On phones the columns dissolve
        // (display: contents) so the player can sit right under the picture.
        <div className="mx-auto grid max-w-6xl gap-6 px-5 pb-16 md:grid-cols-[300px_minmax(0,1fr)] md:items-start">
          <aside className="contents md:block md:space-y-6">
            <div className="order-1 md:order-none">{avatar}</div>
            {ownerNote && (
              <div className="order-3 md:order-none">{ownerNote}</div>
            )}
            <div className="order-4 md:order-none">{membershipPanel}</div>
            {links && <div className="order-6 md:order-none">{links}</div>}
          </aside>
          <div className="contents min-w-0 md:block md:space-y-6">
            <div className="order-2 min-w-0 md:order-none">{player}</div>
            {about && <div className="order-5 md:order-none">{about}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/** A MySpace-style box: colored title bar on top of a translucent panel. */
export function Panel({
  title,
  heading,
  children,
}: {
  title: string;
  heading: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--room-accent)] bg-[var(--room-panel)] backdrop-blur-sm">
      <h2
        style={heading}
        className="bg-[var(--room-accent)] px-4 py-2 text-sm font-bold uppercase tracking-[.12em] text-[var(--room-accent-text)]"
      >
        {title}
      </h2>
      <div className="p-5">{children}</div>
    </section>
  );
}
