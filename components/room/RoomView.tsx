import type { CSSProperties, ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { RoomProfile } from "@/lib/room-profile";
import { BreathLayer } from "@/components/room/BreathLayer";
import { MotionPause } from "@/components/room/MotionPause";
import {
  BOX_EFFECTS,
  bestTextOn,
  boxEffects,
  fill,
  FONTS,
  hexToRgba,
  stops,
} from "@/lib/room-theme";

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
  const box = boxEffects(theme);
  const accentText = bestTextOn(stops(theme.accentColor, theme.accentGradient));
  const accentFill = fill(theme.accentColor, theme.accentGradient);
  const panelFill = fill(
    hexToRgba(theme.panelColor, theme.panelOpacity),
    theme.panelGradient,
    theme.panelGradient
      ? hexToRgba(theme.panelGradient.color, theme.panelOpacity)
      : undefined,
  );

  // Background layers, top first: the band's picture (if any), then the
  // color blend (if any), then the plain background color underneath.
  const image = profile.backgroundUrl
    ? {
        image: `url("${profile.backgroundUrl}")`,
        repeat: theme.bgMode === "tile" ? "repeat" : "no-repeat",
        size: theme.bgMode === "tile" ? "auto" : "cover",
        position: "center top",
        // Tiles scroll with the page like on MySpace; a full-screen image
        // stays put behind the content.
        attachment:
          fixedBackground && theme.bgMode === "cover" ? "fixed" : "scroll",
      }
    : null;
  const blend = theme.bgGradient
    ? {
        image: fill(theme.bgColor, theme.bgGradient),
        repeat: "no-repeat",
        size: "100% 100%",
        position: "center",
        // A fixed blend spans the screen, so it looks the same while scrolling.
        attachment: fixedBackground ? "fixed" : "scroll",
      }
    : null;
  const layers = [image, blend].filter((layer) => layer !== null);
  const list = (key: keyof (typeof layers)[number]) =>
    layers.map((layer) => layer[key]).join(", ");

  const style = {
    "--room-bg": theme.bgColor,
    "--room-text": theme.textColor,
    "--room-accent": theme.accentColor,
    "--room-accent-fill": accentFill,
    "--room-accent-text": accentText,
    "--room-panel": panelFill,
    "--room-shadow": box.shadow,
    "--room-backdrop": box.backdrop,
    "--room-box-border": box.border,
    "--room-border-width": box.borderWidth,
    "--room-radius": box.radius,
    "--room-heading-font": FONTS[theme.headingFont].stack,
    backgroundColor: theme.bgColor,
    color: theme.textColor,
    fontFamily: FONTS[theme.bodyFont].stack,
    ...(layers.length > 0
      ? {
          backgroundImage: list("image"),
          backgroundRepeat: list("repeat"),
          backgroundSize: list("size"),
          backgroundPosition: list("position"),
          backgroundAttachment: list("attachment"),
        }
      : {}),
  } as CSSProperties;

  const heading = { fontFamily: "var(--room-heading-font)" };
  const centered = theme.layout === "centered";

  const avatar = (
    <div
      className={`overflow-hidden [background:var(--room-panel)] ${BOX_EFFECTS}`}
    >
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
            background: theme.accentGradient
              ? accentFill
              : `linear-gradient(135deg, ${theme.accentColor}, ${hexToRgba(theme.accentColor, 35)})`,
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
    <div style={style} className="relative isolate min-h-screen">
      <BreathLayer theme={theme} fixed={fixedBackground} />
      {/* The pause button belongs to the live room, not the editor preview. */}
      {fixedBackground && theme.breath !== "off" && <MotionPause />}
      {nav && (
        <div className="[background:var(--room-panel)] [backdrop-filter:var(--room-backdrop)]">
          {nav}
        </div>
      )}
      <header
        className={`mx-auto max-w-6xl px-5 pb-6 pt-6 md:pt-10 ${centered ? "max-w-2xl text-center" : ""}`}
      >
        <div
          className={`[background:var(--room-panel)] p-6 md:p-8 ${BOX_EFFECTS}`}
          // The title box has no colored frame, only the glass rim.
          style={theme.glass ? undefined : { borderColor: "transparent" }}
        >
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
    <section
      className={`overflow-hidden [background:var(--room-panel)] ${BOX_EFFECTS}`}
    >
      <h2
        style={heading}
        className="[background:var(--room-accent-fill)] px-4 py-2 text-sm font-bold uppercase tracking-[.12em] text-[var(--room-accent-text)]"
      >
        {title}
      </h2>
      <div className="p-5">{children}</div>
    </section>
  );
}
