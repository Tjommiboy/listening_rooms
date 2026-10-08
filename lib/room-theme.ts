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
export type Layout = "classic" | "centered";

export type RoomTheme = {
  bgColor: string;
  bgMode: BackgroundMode; // how the background image (if any) is shown
  textColor: string;
  accentColor: string;
  panelColor: string;
  panelOpacity: number; // 0–100
  headingFont: FontId;
  bodyFont: FontId;
  layout: Layout;
  autoplay: boolean; // start the first track when a member opens the room
};

export type RoomLink = { label: string; url: string };

export const DEFAULT_THEME: RoomTheme = {
  bgColor: "#f3eee6",
  bgMode: "cover",
  textColor: "#193a35",
  accentColor: "#e9a172",
  panelColor: "#ffffff",
  panelOpacity: 55,
  headingFont: "georgia",
  bodyFont: "arial",
  layout: "classic",
  autoplay: false,
};

/** A few ready-made looks to start from. */
export const PRESETS: { id: string; theme: Partial<RoomTheme> }[] = [
  { id: "paper", theme: DEFAULT_THEME },
  {
    id: "2005",
    theme: {
      bgColor: "#000000",
      textColor: "#ffffff",
      accentColor: "#ff3399",
      panelColor: "#1a1a1a",
      panelOpacity: 85,
      headingFont: "impact",
      bodyFont: "verdana",
    },
  },
  {
    id: "emo",
    theme: {
      bgColor: "#140014",
      textColor: "#f5e6ff",
      accentColor: "#b266ff",
      panelColor: "#000000",
      panelOpacity: 70,
      headingFont: "times",
      bodyFont: "trebuchet",
    },
  },
  {
    id: "punk",
    theme: {
      bgColor: "#ffef00",
      textColor: "#000000",
      accentColor: "#ff0000",
      panelColor: "#ffffff",
      panelOpacity: 90,
      headingFont: "courier",
      bodyFont: "courier",
    },
  },
  {
    id: "sky",
    theme: {
      bgColor: "#99ccff",
      textColor: "#003366",
      accentColor: "#ff6600",
      panelColor: "#ffffff",
      panelOpacity: 80,
      headingFont: "comic",
      bodyFont: "verdana",
    },
  },
];

const HEX = /^#[0-9a-f]{6}$/i;
const color = (value: unknown, fallback: string) =>
  typeof value === "string" && HEX.test(value) ? value.toLowerCase() : fallback;

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
  return {
    bgColor: color(raw.bgColor, d.bgColor),
    bgMode: raw.bgMode === "tile" ? "tile" : "cover",
    textColor: color(raw.textColor, d.textColor),
    accentColor: color(raw.accentColor, d.accentColor),
    panelColor: color(raw.panelColor, d.panelColor),
    panelOpacity: Number.isFinite(opacity)
      ? Math.min(100, Math.max(0, Math.round(opacity)))
      : d.panelOpacity,
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

/** Panel color blended over the background, as the reader sees it. */
export function effectivePanelColor(theme: RoomTheme) {
  const a = theme.panelOpacity / 100;
  const mix = (i: number) =>
    Math.round(
      parseInt(theme.panelColor.slice(i, i + 2), 16) * a +
        parseInt(theme.bgColor.slice(i, i + 2), 16) * (1 - a),
    )
      .toString(16)
      .padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

export function hexToRgba(hex: string, opacityPercent: number) {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgba(${n(1)}, ${n(3)}, ${n(5)}, ${opacityPercent / 100})`;
}

// --- Room images (avatar and background) ---

export const IMAGE_KINDS = ["avatar", "background"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
// layout are left alone (unlike PRESETS). All have readable text contrast. ---

export type PaletteColors = Pick<
  RoomTheme,
  "bgColor" | "textColor" | "accentColor" | "panelColor" | "panelOpacity"
>;

const palette = (
  id: string,
  bgColor: string,
  textColor: string,
  accentColor: string,
  panelColor: string,
  panelOpacity: number,
) => ({
  id,
  colors: { bgColor, textColor, accentColor, panelColor, panelOpacity },
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
