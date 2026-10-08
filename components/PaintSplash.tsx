// A random paint splatter, drawn as SVG. Every page load gets a new splash.
// Used on the front page's "Create your room" button: the right half looks
// hit by paint, with drips and droplets landing around that side.

// A full trip round the color wheel. Each hue is the brightest version that
// still keeps WCAG AA contrast (≥ 4.5:1) with the button's white text, so the
// label stays readable wherever the paint lands. Ratios against #ffffff:
export const SPLASH_COLORS = [
  "#e61717", // red        4.67
  "#c44f14", // orange     4.69
  "#996b0f", // amber      4.70
  "#78780c", // olive      4.68
  "#35850d", // green      4.65
  "#0d855d", // emerald    4.64
  "#0d8282", // teal       4.63
  "#127bb0", // sky        4.68
  "#1966ff", // blue       4.79
  "#6619ff", // indigo     6.67
  "#b319ff", // violet     4.67
  "#cc14cc", // magenta    4.63
  "#d91698", // fuchsia    4.65
  "#e3175b", // pink       4.63
];
const COLORS = SPLASH_COLORS;

function seeded(seed: number) {
  // mulberry32: tiny deterministic random generator
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Irregular blob with a few long "splash" spikes, as a smooth closed path. */
function splatPath(
  rand: () => number,
  cx: number,
  cy: number,
  radius: number,
  points: number,
) {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2 + rand() * 0.3;
    const spike = rand() < 0.16 ? 1.35 + rand() * 0.7 : 0.78 + rand() * 0.35;
    const r = radius * spike;
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.8]);
  }
  // Quadratic curves through the midpoints give soft, liquid edges.
  const mid = (a: [number, number], b: [number, number]) =>
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const start = mid(pts[pts.length - 1], pts[0]);
  let d = `M${start[0].toFixed(1)},${start[1].toFixed(1)}`;
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % pts.length]);
    d += ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`;
  });
  return `${d} Z`;
}

export function PaintSplash({ seed }: { seed: number }) {
  const rand = seeded(seed);
  const pick = () => COLORS[Math.floor(rand() * COLORS.length)];
  // Three different colors per splash, plus droplets from anywhere on the
  // wheel, so every load is a little rainbow accident.
  const main = pick();
  let second = pick();
  while (second === main) second = pick();
  let third = pick();
  while (third === main || third === second) third = pick();

  // Coordinates: the SVG is 200×140 px, placed so the button's right half
  // is roughly x 34–100, y 46–96.
  const cx = 64 + rand() * 12;
  const cy = 68 + rand() * 6;

  const drips = Array.from({ length: 2 + Math.floor(rand() * 3) }, () => {
    const x = cx - 22 + rand() * 44;
    const top = cy + 8;
    const length = 16 + rand() * 38;
    const width = 2.5 + rand() * 3.5;
    return { x, top, length, width };
  });

  // Droplets fly outwards to the right, above and below — not to the left.
  const drops = Array.from({ length: 10 + Math.floor(rand() * 8) }, () => {
    const angle = -Math.PI / 2 - 0.4 + rand() * (Math.PI + 0.8);
    const dist = 42 + rand() * 50;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist * 0.7,
      r: 0.8 + rand() * 3.2,
      color: [main, second, third, pick()][Math.floor(rand() * 4)],
    };
  });

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 140"
      className="pointer-events-none absolute left-[calc(50%-34px)] top-[-46px] h-[140px] w-[200px] overflow-visible"
    >
      <path d={splatPath(rand, cx, cy, 31, 20)} fill={main} />
      <path
        d={splatPath(rand, cx + 22 + rand() * 12, cy - 10 + rand() * 20, 9, 12)}
        fill={third}
      />
      <path
        d={splatPath(rand, cx + 8 - rand() * 16, cy - 6 + rand() * 12, 13, 14)}
        fill={second}
      />
      <path
        d={splatPath(rand, cx - 6 + rand() * 18, cy + 4 + rand() * 8, 7, 10)}
        fill={third}
      />
      {drips.map((drip, i) => (
        <g key={`d${i}`} fill={i % 2 ? second : main}>
          <rect
            x={drip.x - drip.width / 2}
            y={drip.top}
            width={drip.width}
            height={drip.length}
            rx={drip.width / 2}
          />
          <circle
            cx={drip.x}
            cy={drip.top + drip.length}
            r={drip.width * 0.75}
          />
        </g>
      ))}
      {drops.map((drop, i) => (
        <circle
          key={`s${i}`}
          cx={drop.x}
          cy={drop.y}
          r={drop.r}
          fill={drop.color}
        />
      ))}
    </svg>
  );
}

/** A fresh seed per request, so each visit gets a different splash. */
export function newSplashSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
