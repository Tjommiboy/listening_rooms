"use client";

import { useRef, useState } from "react";
import { hexToHsv, hsvToHex, QUICK_COLORS, type Hsv } from "@/lib/room-theme";

const HEX = /^#[0-9a-f]{6}$/i;

type Labels = {
  spectrum: string;
  spectrumHint: string;
  hue: string;
  hex: string;
  quickColors: string;
};

/**
 * A full-spectrum color picker: drag in the field for saturation/brightness,
 * slide for hue, type a hex code, or click a classic web color.
 */
export function ColorPicker({
  value,
  onChange,
  labels,
}: {
  value: string;
  onChange: (hex: string) => void;
  labels: Labels;
}) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [synced, setSynced] = useState(value);
  const [hexText, setHexText] = useState(value);
  const field = useRef<HTMLDivElement>(null);

  // When the color is changed from outside (a palette, another target), take
  // it over. Keep our own hue for greys, where the hex alone loses it.
  if (value !== synced) {
    const next = hexToHsv(value);
    setHsv(next.s === 0 ? { ...next, h: hsv.h } : next);
    setSynced(value);
    setHexText(value);
  }

  function emit(next: Hsv) {
    const hex = hsvToHex(next);
    setHsv(next);
    setSynced(hex);
    setHexText(hex);
    onChange(hex);
  }

  function pickAt(clientX: number, clientY: number) {
    const box = field.current?.getBoundingClientRect();
    if (!box) return;
    const s = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const v = 1 - Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    emit({ ...hsv, s, v });
  }

  function onKey(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: Math.max(0, hsv.s - step) },
      ArrowRight: { s: Math.min(1, hsv.s + step) },
      ArrowUp: { v: Math.min(1, hsv.v + step) },
      ArrowDown: { v: Math.max(0, hsv.v - step) },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    emit({ ...hsv, ...move });
  }

  const pureHue = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <div className="space-y-3">
      {/* Saturation (left→right) × brightness (bottom→top) */}
      <div
        ref={field}
        role="slider"
        tabIndex={0}
        aria-label={labels.spectrum}
        title={labels.spectrumHint}
        aria-valuetext={value}
        aria-valuenow={Math.round(hsv.s * 100)}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pickAt(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            pickAt(e.clientX, e.clientY);
        }}
        className="relative h-40 w-full cursor-crosshair touch-none rounded-md border border-sand outline-offset-2 focus-visible:outline-2 dark:border-slate/40"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})`,
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.6)]"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: value,
          }}
        />
      </div>

      {/* Hue: the full rainbow */}
      <label className="block">
        <span className="sr-only">{labels.hue}</span>
        <input
          type="range"
          min={0}
          max={359}
          value={Math.round(hsv.h)}
          onChange={(e) => emit({ ...hsv, h: Number(e.target.value) })}
          className="hue-slider h-4 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background:
              "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          }}
        />
      </label>

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-9 shrink-0 rounded border border-sand dark:border-slate/40"
          style={{ background: value }}
        />
        <label className="flex-1 text-xs font-bold">
          {labels.hex}
          <input
            value={hexText}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              let text = e.target.value.trim();
              if (!text.startsWith("#")) text = `#${text}`;
              setHexText(text);
              if (HEX.test(text)) {
                const hex = text.toLowerCase();
                setHsv(hexToHsv(hex));
                setSynced(hex);
                onChange(hex);
              }
            }}
            className="mt-1 w-full rounded border border-sand bg-white px-2 py-1 font-mono text-sm font-normal text-ink dark:border-slate/40"
          />
        </label>
      </div>

      <div>
        <p className="text-xs font-bold">{labels.quickColors}</p>
        <div className="mt-1 grid grid-cols-9 gap-1">
          {QUICK_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={color}
              aria-pressed={color === value}
              onClick={() => {
                setHsv(hexToHsv(color));
                setSynced(color);
                setHexText(color);
                onChange(color);
              }}
              className={`aspect-square rounded-sm border ${color === value ? "border-2 border-ink dark:border-cream" : "border-black/20"}`}
              style={{ background: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
