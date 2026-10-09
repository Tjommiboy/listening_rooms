"use client";

import {
  bestTextOn,
  fill,
  GRADIENT_DIRECTIONS,
  hexToHsv,
  hsvToHex,
  type Gradient,
  type GradientDirection,
} from "@/lib/room-theme";

const ARROWS: Record<GradientDirection, string> = {
  nw: "↖",
  n: "↑",
  ne: "↗",
  w: "←",
  center: "◎",
  e: "→",
  sw: "↙",
  s: "↓",
  se: "↘",
};

type Labels = {
  solid: string;
  gradient: string;
  gradientFrom: string;
  gradientTo: string;
  swapColors: string;
  direction: string;
  directionHint: string;
  directionNames: Record<GradientDirection, string>;
};

/** A pleasing second color to start a blend from: the hue moved a bit. */
export function suggestSecondColor(hex: string) {
  const { h, s, v } = hexToHsv(hex);
  return hsvToHex({
    h: (h + 45) % 360,
    s: Math.max(s, 0.45),
    v: v < 0.25 ? 0.45 : v,
  });
}

/**
 * Turns a color into a blend: pick which end the color picker edits, swap the
 * two ends, and choose which way the blend flows. Every direction button is
 * drawn with the real blend, so you see the result before you click.
 */
export function GradientControls({
  base,
  gradient,
  stop,
  onStop,
  onChange,
  onSwap,
  defaultDirection,
  labels,
}: {
  base: string;
  gradient: Gradient | null;
  stop: 0 | 1;
  onStop: (stop: 0 | 1) => void;
  onChange: (gradient: Gradient | null) => void;
  onSwap: () => void;
  defaultDirection: GradientDirection;
  labels: Labels;
}) {
  const segment = (active: boolean) =>
    `flex-1 px-3 py-1.5 text-sm font-bold ${active ? "bg-ink text-paper dark:bg-cream dark:text-ink" : ""}`;

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        className="flex overflow-hidden rounded border border-ink dark:border-cream"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!gradient}
          onClick={() => {
            onStop(0);
            onChange(null);
          }}
          className={segment(!gradient)}
        >
          {labels.solid}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={Boolean(gradient)}
          onClick={() =>
            !gradient &&
            onChange({
              color: suggestSecondColor(base),
              direction: defaultDirection,
            })
          }
          className={segment(Boolean(gradient))}
        >
          {labels.gradient}
        </button>
      </div>

      {gradient && (
        <>
          <div className="flex items-stretch gap-2">
            {([0, 1] as const).map((index) => {
              const color = index === 0 ? base : gradient.color;
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={stop === index}
                  onClick={() => onStop(index)}
                  className={`flex flex-1 items-center gap-2 rounded border px-2 py-1.5 text-sm font-bold ${stop === index ? "border-2 border-ink bg-white/60 dark:border-cream dark:bg-white/10" : "border-sand dark:border-slate/40"}`}
                >
                  <span
                    aria-hidden="true"
                    className="size-6 shrink-0 rounded-full border border-black/20"
                    style={{ background: color }}
                  />
                  <span className="truncate">
                    {index === 0 ? labels.gradientFrom : labels.gradientTo}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onSwap}
              title={labels.swapColors}
              aria-label={labels.swapColors}
              className="rounded border border-sand px-3 text-lg dark:border-slate/40"
            >
              ⇄
            </button>
          </div>

          <fieldset>
            <legend className="text-sm font-bold">{labels.direction}</legend>
            <p className="text-xs text-moss dark:text-stone">
              {labels.directionHint}
            </p>
            <div className="mt-2 grid w-40 grid-cols-3 gap-1.5">
              {GRADIENT_DIRECTIONS.map((direction) => {
                const preview = { ...gradient, direction };
                const active = gradient.direction === direction;
                return (
                  <button
                    key={direction}
                    type="button"
                    aria-pressed={active}
                    aria-label={labels.directionNames[direction]}
                    title={labels.directionNames[direction]}
                    onClick={() => onChange(preview)}
                    className={`grid aspect-square place-items-center rounded text-lg font-bold ${active ? "ring-2 ring-ink ring-offset-2 dark:ring-cream dark:ring-offset-night" : "border border-black/20"}`}
                    style={{
                      background: fill(base, preview),
                      color: bestTextOn([base, gradient.color]),
                    }}
                  >
                    {ARROWS[direction]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}
