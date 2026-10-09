// A hidden-in-plain-sight wallpaper for the front page: peace symbols, peace
// hands, doves, hearts, flowers and a camper van, drawn tone-on-tone so they
// sit just above the background color. You only notice them if you look.
//
// All motifs are drawn from scratch here (simple geometric shapes), not
// traced from any clip-art pack. The peace symbol itself is free to use.

const INK = "currentColor";

/** Classic peace symbol in a 100×100 box. */
function Peace({
  filled = false,
  thin = false,
}: {
  filled?: boolean;
  thin?: boolean;
}) {
  const w = thin ? 3 : 8;
  return (
    <g fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round">
      {filled ? (
        <>
          <circle cx="50" cy="50" r="44" fill={INK} stroke="none" />
          <g stroke="var(--wallpaper-bg)" strokeWidth={8}>
            <circle cx="50" cy="50" r="34" />
            <path d="M50 16V84M50 50L26 74M50 50L74 74" />
          </g>
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="42" />
          {thin && <circle cx="50" cy="50" r="35" />}
          <path d="M50 8V92M50 50L20.3 79.7M50 50L79.7 79.7" />
        </>
      )}
    </g>
  );
}

/** Heart with a peace symbol inside. */
function PeaceHeart() {
  return (
    <g
      fill="none"
      stroke={INK}
      strokeWidth={7}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M50 88C20 66 6 50 6 32C6 18 17 8 30 8C39 8 46 13 50 21C54 13 61 8 70 8C83 8 94 18 94 32C94 50 80 66 50 88Z" />
      <path d="M50 21V88M50 52L27 72M50 52L73 72" />
    </g>
  );
}

/** Simple "V" peace hand. */
function PeaceHand() {
  return (
    <g fill={INK}>
      <rect
        x="27"
        y="4"
        width="15"
        height="52"
        rx="7.5"
        transform="rotate(-12 34 30)"
      />
      <rect
        x="52"
        y="4"
        width="15"
        height="52"
        rx="7.5"
        transform="rotate(12 60 30)"
      />
      <rect x="24" y="48" width="52" height="44" rx="16" />
      <rect
        x="10"
        y="52"
        width="26"
        height="14"
        rx="7"
        transform="rotate(25 23 59)"
      />
    </g>
  );
}

/** Dove carrying an olive branch. */
function Dove() {
  return (
    <g fill={INK}>
      <path d="M10 58C24 44 44 40 60 44L84 30L78 44C88 46 94 52 96 58C86 56 78 58 72 62C62 72 44 76 26 70L8 78L16 64Z" />
      <path d="M44 46C46 30 54 16 70 8C66 22 66 34 60 44Z" />
      <circle cx="84" cy="50" r="2.2" fill="var(--wallpaper-bg)" />
      <path
        d="M96 58Q104 62 108 70"
        fill="none"
        stroke={INK}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <ellipse cx="103" cy="62" rx="4" ry="2" transform="rotate(30 103 62)" />
      <ellipse cx="106" cy="68" rx="4" ry="2" transform="rotate(-20 106 68)" />
    </g>
  );
}

/** Five-petal flower. */
function Flower() {
  const petals = [0, 72, 144, 216, 288];
  return (
    <g fill={INK}>
      {petals.map((a) => (
        <ellipse
          key={a}
          cx="50"
          cy="24"
          rx="15"
          ry="22"
          transform={`rotate(${a} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="12" fill="var(--wallpaper-bg)" />
      <circle cx="50" cy="50" r="7" />
    </g>
  );
}

/** Solid little heart. */
function Heart() {
  return (
    <path
      fill={INK}
      d="M50 90C20 68 6 52 6 33C6 19 17 9 30 9C39 9 46 14 50 22C54 14 61 9 70 9C83 9 94 19 94 33C94 52 80 68 50 90Z"
    />
  );
}

/** A generic camper van seen from the side, with a peace sign on it. */
function Van() {
  return (
    <g>
      <path
        fill={INK}
        d="M6 30Q6 14 22 14H86Q100 14 104 28L112 52Q114 58 114 64V74Q114 80 108 80H12Q6 80 6 74Z"
      />
      <g fill="var(--wallpaper-bg)">
        <rect x="16" y="22" width="18" height="16" rx="3" />
        <rect x="40" y="22" width="18" height="16" rx="3" />
        <rect x="64" y="22" width="18" height="16" rx="3" />
        <path d="M88 22H98L104 38H88Z" />
        <circle cx="30" cy="80" r="11" />
        <circle cx="90" cy="80" r="11" />
      </g>
      <circle cx="30" cy="80" r="7" fill={INK} />
      <circle cx="90" cy="80" r="7" fill={INK} />
      <g transform="translate(46 44) scale(0.24)" stroke="var(--wallpaper-bg)">
        <circle cx="50" cy="50" r="40" fill="none" strokeWidth={10} />
        <path d="M50 10V90M50 50L22 78M50 50L78 78" strokeWidth={10} />
      </g>
    </g>
  );
}

/** Five-pointed star. */
function Star() {
  return (
    <path
      fill="none"
      stroke={INK}
      strokeWidth={6}
      strokeLinejoin="round"
      d="M50 6L62 38H96L68 58L79 92L50 71L21 92L32 58L4 38H38Z"
    />
  );
}

type Motif = {
  x: number;
  y: number;
  size: number;
  rotate: number;
  el: React.ReactNode;
};

// One 480×480 tile, repeated across the page. Positions and angles are
// hand-placed so the repeat doesn't look like a grid.
const TILE = 480;
const MOTIFS: Motif[] = [
  { x: 20, y: 24, size: 86, rotate: -8, el: <Peace /> },
  { x: 170, y: 60, size: 60, rotate: 14, el: <PeaceHand /> },
  { x: 290, y: 18, size: 92, rotate: -6, el: <Dove /> },
  { x: 410, y: 110, size: 48, rotate: 18, el: <Heart /> },
  { x: 60, y: 170, size: 64, rotate: 22, el: <Flower /> },
  { x: 200, y: 190, size: 92, rotate: -4, el: <PeaceHeart /> },
  { x: 350, y: 200, size: 78, rotate: 10, el: <Peace thin /> },
  { x: 18, y: 300, size: 104, rotate: 3, el: <Van /> },
  { x: 180, y: 340, size: 50, rotate: -18, el: <Star /> },
  { x: 270, y: 320, size: 72, rotate: 8, el: <Peace filled /> },
  { x: 390, y: 330, size: 58, rotate: -16, el: <PeaceHand /> },
  { x: 140, y: 420, size: 40, rotate: 30, el: <Flower /> },
  { x: 440, y: 20, size: 34, rotate: 0, el: <Star /> },
];

// --- Sparkles: now and then a single logo brightens for a moment ---
//
// A <pattern> repeats one identical tile, so its motifs can't twinkle one by
// one. Instead, a few dozen copies of single motifs sit exactly on top of the
// pattern, invisible until their turn. Only their opacity animates (see
// .lr-sparkle in globals.css), so the GPU does the work and nothing is
// repainted. Positions and timings come from a fixed seed, so the server and
// browser render the same thing.

function seeded(seed: number) {
  // mulberry32: tiny, fast, good enough for decoration
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLUMNS = 4; // covers screens up to 1920 px wide
const ROWS = 5; // and pages up to 2400 px tall
// Columns past the screen's width are hidden on narrower screens, so their
// animations don't run for nothing.
const HIDE_COLUMN = [
  "",
  "max-[480px]:hidden",
  "max-[960px]:hidden",
  "max-[1440px]:hidden",
];

const SPARKLES = (() => {
  const rng = seeded(1969);
  const sites = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLUMNS; col++)
      for (const motif of MOTIFS) sites.push({ row, col, motif });
  // Pick roughly one in eight motifs to ever sparkle.
  return sites
    .filter(() => rng() < 0.13)
    .map(({ row, col, motif }) => ({
      motif,
      col,
      left: col * TILE + motif.x,
      top: row * TILE + motif.y,
      duration: 9 + rng() * 14, // s: how often this one sparkles
      delay: -rng() * 23, // start somewhere in its cycle
    }));
})();

/** A tiny four-point glint, drawn at a motif's upper right edge. */
function Glint() {
  return (
    <path
      d="M88 4 L91 13 L100 16 L91 19 L88 28 L85 19 L76 16 L85 13 Z"
      fill="var(--wallpaper-glint)"
    />
  );
}

export function PeaceWallpaper({
  color,
  background,
  sparkle,
  glint,
}: {
  /** Motif color: just a shade off the background. */
  color: string;
  /** The page background, used for cut-outs inside motifs. */
  background: string;
  /** A motif's color at the peak of its sparkle: a shade brighter. */
  sparkle?: string;
  /** Color of the small glint that flashes with the sparkle. */
  glint?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={
        {
          "--wallpaper-bg": background,
          "--wallpaper-glint": glint ?? "transparent",
        } as React.CSSProperties
      }
    >
      <svg
        focusable="false"
        className="absolute inset-0 h-full w-full"
        style={{ color }}
      >
        <defs>
          <pattern
            id="peace-wallpaper"
            width={TILE}
            height={TILE}
            patternUnits="userSpaceOnUse"
          >
            {MOTIFS.map((m, i) => (
              <g
                key={i}
                transform={`translate(${m.x} ${m.y}) rotate(${m.rotate} ${m.size / 2} ${m.size / 2}) scale(${m.size / 100})`}
              >
                {m.el}
              </g>
            ))}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#peace-wallpaper)" />
      </svg>

      {sparkle &&
        SPARKLES.map((s, i) => (
          <svg
            key={i}
            focusable="false"
            viewBox="0 0 100 100"
            overflow="visible"
            className={`lr-sparkle absolute ${HIDE_COLUMN[s.col]}`}
            style={{
              left: s.left,
              top: s.top,
              width: s.motif.size,
              height: s.motif.size,
              color: sparkle,
              transform: `rotate(${s.motif.rotate}deg)`,
              animationDuration: `${s.duration.toFixed(1)}s`,
              animationDelay: `${s.delay.toFixed(1)}s`,
            }}
          >
            {s.motif.el}
            <Glint />
          </svg>
        ))}
    </div>
  );
}
