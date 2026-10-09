// MySpace-style room themes. Bands pick from safe, structured options
// (colors, fonts, background image, layout) instead of writing raw HTML/CSS,
// so a room can never run scripts or impersonate the site.

export const FONTS = {
  verdana: {
    label: "Verdana",
    stack: 'Verdana, Geneva, "DejaVu Sans", sans-serif',
  },
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  trebuchet: {
    label: "Trebuchet",
    stack: '"Trebuchet MS", "Lucida Grande", sans-serif',
  },
  georgia: { label: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  times: { label: "Times", stack: '"Times New Roman", Times, serif' },
  courier: { label: "Courier", stack: '"Courier New", Courier, monospace' },
  comic: {
    label: "Comic Sans",
    stack: '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive',
  },
  impact: {
    label: "Impact",
    stack: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
  },
} as const;
export type FontId = keyof typeof FONTS;

export type BackgroundMode = "cover" | "tile";

/**
 * Which way a gradient flows: from the first color toward the second. The
 * eight compass points are linear blends; "center" is a radial blend that
 * starts in the middle and fades outward.
 */
export const GRADIENT_DIRECTIONS = [
  "nw",
  "n",
  "ne",
  "w",
  "center",
  "e",
  "sw",
  "s",
  "se",
] as const;
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number];

/** A second color plus a direction. Null means a plain, solid color. */
export type Gradient = { color: string; direction: GradientDirection };

const CSS_DIRECTION: Record<Exclude<GradientDirection, "center">, string> = {
  n: "to top",
  ne: "to top right",
  e: "to right",
  se: "to bottom right",
  s: "to bottom",
  sw: "to bottom left",
  w: "to left",
  nw: "to top left",
};

/** CSS for a fill: a solid color, or a gradient from `from` toward `to`. */
export function fill(from: string, gradient: Gradient | null, to?: string) {
  if (!gradient) return from;
  const end = to ?? gradient.color;
  return gradient.direction === "center"
    ? `radial-gradient(circle at center, ${from}, ${end})`
    : `linear-gradient(${CSS_DIRECTION[gradient.direction]}, ${from}, ${end})`;
}
export type Layout = "classic" | "centered";

/** How the boxes sit on the page: flat, floating at different heights, a
 * hard retro offset, or a glow in the accent color. */
export const SHADOWS = [
  "none",
  "soft",
  "float",
  "high",
  "retro",
  "glow",
] as const;
export type Shadow = (typeof SHADOWS)[number];

export const GLASS_BLUR = { min: 4, max: 40, default: 16 } as const;

/** Box frame: line thickness and corner rounding in px, line opacity in %. */
export const BORDER_WIDTH = { min: 0, max: 8, default: 1 } as const;
export const BORDER_OPACITY = { min: 0, max: 100, default: 100 } as const;
export const RADIUS = { min: 0, max: 32, default: 8 } as const;

export type RoomTheme = {
  bgColor: string;
  bgGradient: Gradient | null;
  bgMode: BackgroundMode; // how the background image (if any) is shown
  textColor: string;
  accentColor: string;
  accentGradient: Gradient | null; // title bars and buttons; borders stay solid
  panelColor: string;
  panelGradient: Gradient | null;
  panelOpacity: number; // 0–100
  shadow: Shadow;
  glass: boolean; // frosted glass: blurs and brightens what's behind the boxes
  glassBlur: number; // px
  borderWidth: number; // px
  borderOpacity: number; // 0–100
  radius: number; // px
  headingFont: FontId;
  bodyFont: FontId;
  layout: Layout;
  autoplay: boolean; // start the first track when a member opens the room
};

export type RoomLink = { label: string; url: string };

export const DEFAULT_THEME: RoomTheme = {
  bgColor: "#f3eee6",
  bgGradient: null,
  bgMode: "cover",
  textColor: "#193a35",
  accentColor: "#e9a172",
  accentGradient: null,
  panelColor: "#ffffff",
  panelGradient: null,
  panelOpacity: 55,
  shadow: "none",
  glass: false,
  glassBlur: GLASS_BLUR.default,
  borderWidth: BORDER_WIDTH.default,
  borderOpacity: BORDER_OPACITY.default,
  radius: RADIUS.default,
  headingFont: "georgia",
  bodyFont: "arial",
  layout: "classic",
  autoplay: false,
};

const HEX = /^#[0-9a-f]{6}$/i;
const color = (value: unknown, fallback: string) =>
  typeof value === "string" && HEX.test(value) ? value.toLowerCase() : fallback;

function parseGradient(value: unknown): Gradient | null {
  if (!value || typeof value !== "object") return null;
  const { color: c, direction } = value as Record<string, unknown>;
  if (typeof c !== "string" || !HEX.test(c)) return null;
  return {
    color: c.toLowerCase(),
    direction: GRADIENT_DIRECTIONS.includes(direction as GradientDirection)
      ? (direction as GradientDirection)
      : "s",
  };
}

/** Turns stored or submitted JSON into a safe theme. Unknown values fall back. */
export function parseTheme(input: unknown): RoomTheme {
  let raw: Record<string, unknown> = {};
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input) ?? {};
    } catch {}
  } else if (input && typeof input === "object") {
    raw = input as Record<string, unknown>;
  }
  const d = DEFAULT_THEME;
  const font = (v: unknown, f: FontId) =>
    typeof v === "string" && v in FONTS ? (v as FontId) : f;
  const opacity = Number(raw.panelOpacity);
  const blur = Number(raw.glassBlur);
  const clamp = (
    value: unknown,
    range: { min: number; max: number; default: number },
  ) => {
    const n = Number(value);
    return Number.isFinite(n)
      ? Math.min(range.max, Math.max(range.min, Math.round(n)))
      : range.default;
  };
  return {
    bgColor: color(raw.bgColor, d.bgColor),
    bgGradient: parseGradient(raw.bgGradient),
    bgMode: raw.bgMode === "tile" ? "tile" : "cover",
    textColor: color(raw.textColor, d.textColor),
    accentColor: color(raw.accentColor, d.accentColor),
    accentGradient: parseGradient(raw.accentGradient),
    panelColor: color(raw.panelColor, d.panelColor),
    panelGradient: parseGradient(raw.panelGradient),
    panelOpacity: Number.isFinite(opacity)
      ? Math.min(100, Math.max(0, Math.round(opacity)))
      : d.panelOpacity,
    shadow: SHADOWS.includes(raw.shadow as Shadow)
      ? (raw.shadow as Shadow)
      : "none",
    glass: raw.glass === true,
    glassBlur: Number.isFinite(blur)
      ? Math.min(GLASS_BLUR.max, Math.max(GLASS_BLUR.min, Math.round(blur)))
      : d.glassBlur,
    borderWidth: clamp(raw.borderWidth, BORDER_WIDTH),
    borderOpacity: clamp(raw.borderOpacity, BORDER_OPACITY),
    radius: clamp(raw.radius, RADIUS),
    headingFont: font(raw.headingFont, d.headingFont),
    bodyFont: font(raw.bodyFont, d.bodyFont),
    layout: raw.layout === "centered" ? "centered" : "classic",
    autoplay: raw.autoplay === true,
  };
}

export const MAX_LINKS = 6;
export const MAX_BIO = 4000;
export const MAX_TAGLINE = 140;

/** Only http(s) links with a short label are kept. */
export function parseLinks(input: unknown): RoomLink[] {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const links: RoomLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { label, url } = item as Record<string, unknown>;
    if (typeof url !== "string") continue;
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      continue;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
    const text =
      typeof label === "string" && label.trim()
        ? label.trim().slice(0, 40)
        : parsed.hostname.replace(/^www\./, "");
    links.push({ label: text, url: parsed.toString() });
    if (links.length >= MAX_LINKS) break;
  }
  return links;
}

// --- Contrast check, so bands get a warning when text becomes unreadable ---

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A panel color blended over a background color, as the reader sees it. */
function blend(panel: string, bg: string, opacityPercent: number) {
  const a = opacityPercent / 100;
  const mix = (i: number) =>
    Math.round(
      parseInt(panel.slice(i, i + 2), 16) * a +
        parseInt(bg.slice(i, i + 2), 16) * (1 - a),
    )
      .toString(16)
      .padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

/** Both ends of a fill (just one color when it's solid). */
export const stops = (base: string, gradient: Gradient | null) =>
  gradient ? [base, gradient.color] : [base];

/** Every background color the text can end up on, at either end of a blend. */
export function textBackgrounds(theme: RoomTheme) {
  const bgs = stops(theme.bgColor, theme.bgGradient);
  const panels = stops(theme.panelColor, theme.panelGradient).flatMap((panel) =>
    bgs.map((bg) => blend(panel, bg, theme.panelOpacity)),
  );
  return { bgs, panels };
}

/** Black or white, whichever reads best on every color of the fill. */
export function bestTextOn(colors: string[]) {
  const worst = (text: string) =>
    Math.min(...colors.map((c) => contrastRatio(text, c)));
  return worst("#000000") > worst("#ffffff") ? "#000000" : "#ffffff";
}

export function hexToRgba(hex: string, opacityPercent: number) {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgba(${n(1)}, ${n(3)}, ${n(5)}, ${opacityPercent / 100})`;
}

// --- Box effects: shadows and glass ---

/** Classes every box in a room uses, so shadows and glass apply everywhere. */
export const BOX_EFFECTS =
  "border-[var(--room-box-border)] [border-width:var(--room-border-width)] [border-radius:var(--room-radius)] [box-shadow:var(--room-shadow)] [backdrop-filter:var(--room-backdrop)]";

/** The box-shadow for a style. Retro uses the text color, glow the accent. */
export function shadowCss(
  shadow: Shadow,
  colors: { text: string; accent: string },
) {
  switch (shadow) {
    case "soft":
      return "0 1px 3px rgba(0,0,0,.12), 0 6px 16px -4px rgba(0,0,0,.18)";
    case "float":
      return "0 10px 20px -8px rgba(0,0,0,.30), 0 28px 56px -16px rgba(0,0,0,.35)";
    case "high":
      return "0 20px 32px -12px rgba(0,0,0,.35), 0 48px 96px -24px rgba(0,0,0,.50)";
    case "retro":
      return `6px 6px 0 ${colors.text}`;
    case "glow":
      return `0 0 0 1px ${hexToRgba(colors.accent, 50)}, 0 0 28px ${hexToRgba(colors.accent, 55)}`;
    default:
      return "none";
  }
}

/** Shadow, glass highlight, blur and border for the boxes, as CSS values. */
export function boxEffects(theme: RoomTheme) {
  const shadow = shadowCss(theme.shadow, {
    text: theme.textColor,
    accent: theme.accentColor,
  });
  // Glass: a bright top edge and a faint inner rim, like light on a pane.
  const highlight =
    "inset 0 1px 0 rgba(255,255,255,.45), inset 0 0 0 1px rgba(255,255,255,.10)";
  return {
    shadow: theme.glass
      ? shadow === "none"
        ? highlight
        : `${highlight}, ${shadow}`
      : shadow,
    backdrop: theme.glass
      ? `blur(${theme.glassBlur}px) saturate(170%)`
      : "blur(8px)",
    border: theme.glass
      ? `rgba(255, 255, 255, ${(0.35 * theme.borderOpacity) / 100})`
      : hexToRgba(theme.accentColor, theme.borderOpacity),
    borderWidth: `${theme.borderWidth}px`,
    radius: `${theme.radius}px`,
  };
}

// --- Room images (avatar and background) ---

export const IMAGE_KINDS = ["avatar", "background"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * Detects the real image type from the file's first bytes. Only JPEG, PNG,
 * GIF (animated GIFs welcome) and WebP are accepted; never SVG or HTML.
 */
export function sniffImageType(data: ArrayBuffer) {
  const b = new Uint8Array(data.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif";
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

// --- Color palettes: four matching colors applied in one click. Fonts and
// layout are left alone. All have readable text contrast. ---

export type PaletteColors = Pick<
  RoomTheme,
  | "bgColor"
  | "bgGradient"
  | "textColor"
  | "accentColor"
  | "accentGradient"
  | "panelColor"
  | "panelGradient"
  | "panelOpacity"
>;

const palette = (
  id: string,
  bgColor: string,
  textColor: string,
  accentColor: string,
  panelColor: string,
  panelOpacity: number,
  gradients: Partial<
    Pick<PaletteColors, "bgGradient" | "accentGradient" | "panelGradient">
  > = {},
) => ({
  id,
  colors: {
    bgColor,
    bgGradient: null,
    textColor,
    accentColor,
    accentGradient: null,
    panelColor,
    panelGradient: null,
    panelOpacity,
    ...gradients,
  } satisfies PaletteColors,
});

export const PALETTES: { id: string; colors: PaletteColors }[] = [
  palette("midnight", "#0b1026", "#e8ecff", "#ffcc00", "#141b3d", 85),
  palette("neon", "#0d0221", "#f9f871", "#00f5d4", "#1b0a3c", 80),
  palette("blood", "#1a0000", "#f5e6e6", "#b30000", "#2b0000", 85),
  palette("grunge", "#3b3a36", "#e8e3d3", "#c1502e", "#24231f", 85),
  palette("forest", "#1f3b2d", "#f1f7ee", "#9ad16b", "#10241a", 80),
  palette("ocean", "#0077b6", "#ffffff", "#90e0ef", "#03045e", 80),
  palette("bubblegum", "#ffd1e8", "#3d0a26", "#ff2e93", "#ffffff", 80),
  palette("lavender", "#e6e0f8", "#2d1b4e", "#7b4fd6", "#ffffff", 75),
  palette("mint", "#c7f9e5", "#0b3d2e", "#ff6b6b", "#ffffff", 80),
  palette("sunset", "#ffb38a", "#2b0f0a", "#d7263d", "#fff3e8", 80),
  palette("desert", "#e9d8a6", "#3b2a12", "#ca6702", "#fff8e7", 80),
  palette("mono", "#ffffff", "#111111", "#111111", "#f2f2f2", 100),
  // Blends
  palette("dusk", "#2b1055", "#fdf0ff", "#ff7eb3", "#1a0b33", 70, {
    bgGradient: { color: "#a8327f", direction: "s" },
    accentGradient: { color: "#ff9a5a", direction: "e" },
  }),
  palette("aurora", "#04151f", "#e6fff8", "#3cf0c5", "#062530", 75, {
    bgGradient: { color: "#1b4d5c", direction: "ne" },
    accentGradient: { color: "#8a7dff", direction: "e" },
  }),
  palette("vapor", "#ff71ce", "#1a0533", "#01cdfe", "#fffbff", 80, {
    bgGradient: { color: "#b967ff", direction: "se" },
    panelGradient: { color: "#e8fbff", direction: "s" },
  }),
  palette("sunrise", "#fff3b0", "#2a1200", "#e4572e", "#ffffff", 80, {
    bgGradient: { color: "#ff9f68", direction: "center" },
  }),
];

/** Classic web colors for one-click picking in the color picker. */
export const QUICK_COLORS = [
  "#000000",
  "#333333",
  "#808080",
  "#c0c0c0",
  "#ffffff",
  "#ff0000",
  "#ff6600",
  "#ffcc00",
  "#33cc33",
  "#006633",
  "#00ccff",
  "#0066ff",
  "#000080",
  "#6633cc",
  "#ff3399",
  "#ff99cc",
  "#996633",
  "#f3eee6",
];

// --- HSV <-> hex, for the spectrum picker ---

export type Hsv = { h: number; s: number; v: number }; // h 0–360, s/v 0–1

export function hexToHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

// --- Theme banks: four slots for the band's own saved looks ---

export const BANK_COUNT = 4;
export type ThemeBanks = (RoomTheme | null)[];

/** Always exactly BANK_COUNT slots, each a valid theme or empty. */
export function parseBanks(input: unknown): ThemeBanks {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      raw = [];
    }
  }
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: BANK_COUNT }, (_, i) =>
    list[i] && typeof list[i] === "object" ? parseTheme(list[i]) : null,
  );
}

// --- Random colors: a fresh, readable color scheme in one click ---

const pick = <T>(items: readonly T[], rng: () => number) =>
  items[Math.floor(rng() * items.length)];
const between = (min: number, max: number, rng: () => number) =>
  min + rng() * (max - min);
const hue = (h: number) => ((h % 360) + 360) % 360;

/** Which parts the randomizer must leave alone because a picture covers them. */
export type RandomOptions = {
  /** A background picture is set: keep the background color and blend, and
   * keep boxes fairly solid so text stays readable over any picture. */
  keepBackground?: boolean;
};

/**
 * Builds a random but harmonious set of colors (and sometimes blends) around
 * one base hue, and only returns it if all text stays readable (WCAG AA) at
 * both ends of every blend.
 */
export function randomColors(
  current: RoomTheme,
  options: RandomOptions = {},
  rng: () => number = Math.random,
): PaletteColors {
  const directions = GRADIENT_DIRECTIONS;
  const keepBg = options.keepBackground === true;
  // With a kept background, work out from it whether the room is dark.
  const keptDark =
    contrastRatio(current.bgColor, "#ffffff") >
    contrastRatio(current.bgColor, "#000000");

  for (let attempt = 0; attempt < 120; attempt++) {
    const base = keepBg ? hexToHsv(current.bgColor).h : rng() * 360;
    // Where the accent sits on the color wheel: close, opposite or a third.
    const offset = pick([30, 150, 180, 210, 120, 240], rng);
    const dark = keepBg ? keptDark : rng() < 0.55;
    const hsv = (h: number, s: [number, number], v: [number, number]) =>
      hsvToHex({
        h: hue(h),
        s: between(s[0], s[1], rng),
        v: between(v[0], v[1], rng),
      });

    const bgS: [number, number] = dark ? [0.35, 0.9] : [0.06, 0.4];
    const bgV: [number, number] = dark ? [0.08, 0.3] : [0.85, 1];
    const colors: PaletteColors = {
      bgColor: keepBg ? current.bgColor : hsv(base, bgS, bgV),
      bgGradient: keepBg
        ? current.bgGradient
        : rng() < 0.5
          ? {
              color: hsv(base + between(-60, 60, rng), bgS, bgV),
              direction: pick(directions, rng),
            }
          : null,
      textColor: dark
        ? hsv(base, [0, 0.1], [0.92, 1])
        : hsv(base, [0.3, 0.8], [0.08, 0.25]),
      accentColor: hsv(base + offset, [0.55, 1], [0.7, 1]),
      accentGradient:
        rng() < 0.45
          ? {
              color: hsv(
                base + offset + between(30, 90, rng),
                [0.55, 1],
                [0.7, 1],
              ),
              direction: pick(["e", "w", "se", "ne"] as const, rng),
            }
          : null,
      panelColor: dark
        ? hsv(base + between(-20, 20, rng), [0.3, 0.7], [0.04, 0.18])
        : hsv(base, [0, 0.12], [0.96, 1]),
      panelGradient: null,
      // Over a picture the boxes must carry the text on their own.
      panelOpacity: Math.round(between(keepBg ? 82 : 55, 95, rng)),
    };
    if (rng() < 0.25)
      colors.panelGradient = {
        color: dark
          ? hsv(base + offset, [0.3, 0.7], [0.04, 0.18])
          : hsv(base + offset, [0, 0.15], [0.94, 1]),
        direction: pick(directions, rng),
      };

    if (readable({ ...DEFAULT_THEME, ...colors }, keepBg)) return colors;
  }

  // Practically never reached: plain, safe boxes on the kept or a calm
  // background.
  const dark = keepBg ? keptDark : false;
  return {
    bgColor: keepBg ? current.bgColor : "#f3eee6",
    bgGradient: keepBg ? current.bgGradient : null,
    textColor: dark ? "#f5f5f5" : "#111111",
    accentColor: dark ? "#fbbf24" : "#c2410c",
    accentGradient: null,
    panelColor: dark ? "#000000" : "#ffffff",
    panelGradient: null,
    panelOpacity: 92,
  };
}

/**
 * All text readable on the boxes and background, at every end of a blend.
 * Under a background picture the bare background color never shows, so only
 * the (fairly solid) boxes count.
 */
function readable(theme: RoomTheme, pictureBehind = false) {
  const { bgs, panels } = textBackgrounds(theme);
  const textOk = [...(pictureBehind ? [] : bgs), ...panels].every(
    (c) => contrastRatio(theme.textColor, c) >= 4.5,
  );
  const accentStops = stops(theme.accentColor, theme.accentGradient);
  const label = bestTextOn(accentStops);
  return (
    textOk &&
    accentStops.every((c) => contrastRatio(label, c) >= 4.5) &&
    panels.every((c) => contrastRatio(theme.accentColor, c) >= 3)
  );
}

// Fonts that stay comfortable for longer text; headings can be anything.
const BODY_FONTS: FontId[] = ["verdana", "arial", "trebuchet", "georgia"];

/**
 * A whole new look: colors and blends, fonts, shadow, glass and borders.
 * Layout and autoplay are left as they are, and so is anything a picture
 * covers (see RandomOptions).
 */
export function randomLook(
  current: RoomTheme,
  options: RandomOptions = {},
  rng: () => number = Math.random,
): RoomTheme {
  const colors = randomColors(current, options, rng);
  const glass = rng() < 0.3;
  const theme: RoomTheme = {
    ...current,
    ...colors,
    headingFont: pick(Object.keys(FONTS) as FontId[], rng),
    bodyFont: pick(BODY_FONTS, rng),
    shadow: pick(SHADOWS, rng),
    glass,
    glassBlur: Math.round(between(8, 28, rng)),
    borderWidth: pick([0, 1, 1, 2, 3], rng),
    borderOpacity: Math.round(between(30, 100, rng)),
    radius: pick([0, 4, 8, 12, 20, 28], rng),
  };
  // Glass needs see-through boxes; only go clearer if text stays readable.
  if (glass && !options.keepBackground) {
    const clearer = {
      ...theme,
      panelOpacity: Math.round(between(30, 55, rng)),
    };
    if (readable(clearer)) return clearer;
  }
  return theme;
}
