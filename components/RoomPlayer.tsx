"use client";

import { useState } from "react";

export function RoomPlayer({ tracks }: { tracks: string[] }) {
  const [current, setCurrent] = useState(0);
  const step = (delta: number) =>
    setCurrent((index) => (index + delta + tracks.length) % tracks.length);

  return (
    <section className="rounded-3xl bg-night p-6 text-cream shadow-2xl md:grid md:grid-cols-[260px_1fr] md:gap-10 md:p-10">
      <div
        aria-hidden="true"
        className="grid min-h-56 place-items-center rounded-2xl bg-linear-135 from-clay to-sun text-7xl text-white/70"
      >
        ♪
      </div>
      <div className="mt-8 md:mt-0">
        <p className="text-xs font-bold tracking-[.16em] text-clay">
          MEMBERS’ RELEASE
        </p>
        <h2 className="mt-3 text-3xl font-bold" aria-live="polite">
          {tracks[current]}
        </h2>
        <p className="mt-2 text-stone">
          Unreleased recording · private stream · track {current + 1} of{" "}
          {tracks.length}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            aria-label="Previous track"
            onClick={() => step(-1)}
            className="grid size-10 place-items-center rounded-full bg-cream text-xl text-ink"
          >
            ‹
          </button>
          <button
            aria-label="Play preview (members only)"
            disabled
            title="Streaming is available to members once memberships open."
            className="grid size-14 place-items-center rounded-full bg-clay text-xl text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            ▶
          </button>
          <button
            aria-label="Next track"
            onClick={() => step(1)}
            className="grid size-10 place-items-center rounded-full bg-cream text-xl text-ink"
          >
            ›
          </button>
          <span className="ml-2 text-sm text-stone">
            Streaming opens with memberships.
          </span>
        </div>
      </div>
    </section>
  );
}
