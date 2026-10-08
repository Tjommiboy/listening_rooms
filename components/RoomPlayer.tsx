"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";

type Track = { id: string; title: string };

/**
 * MySpace-style music player: the current track on top, the full track list
 * below. Colors come from the room theme (CSS variables set by RoomView).
 */
export function RoomPlayer({
  tracks,
  canPlay,
  autoplay = false,
  preview = false,
}: {
  tracks: Track[];
  canPlay: boolean;
  autoplay?: boolean;
  /** In the editor preview: show the player, but never load audio. */
  preview?: boolean;
}) {
  const t = useT().player;
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const track = tracks[current];
  const playable = canPlay && !preview;

  // MySpace-style autoplay of the first track (for members). Browsers may
  // block it until the visitor has interacted with the page; that's fine.
  useEffect(() => {
    if (!autoplay || !playable) return;
    audio.current?.play().catch(() => {});
  }, [autoplay, playable]);

  const select = (index: number) => {
    setStarted(true);
    setCurrent((index + tracks.length) % tracks.length);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--room-accent)] bg-[var(--room-panel)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 bg-[var(--room-accent)] px-4 py-2 text-[var(--room-accent-text)]">
        <p className="text-sm font-bold uppercase tracking-[.12em]">
          ♫ {canPlay ? t.hasAccess : t.membersOnly}
        </p>
        {track && (
          <p className="text-xs opacity-80">
            {current + 1} / {tracks.length}
          </p>
        )}
      </div>

      <div className="p-5">
        {track ? (
          <>
            <h2
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--room-heading-font)" }}
              aria-live="polite"
            >
              {track.title}
            </h2>
            <p className="mt-1 text-sm opacity-75">
              {t.meta(current + 1, tracks.length)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                aria-label={t.previous}
                onClick={() => select(current - 1)}
                className="grid size-10 place-items-center rounded-full bg-[var(--room-accent)] text-xl text-[var(--room-accent-text)]"
              >
                ‹
              </button>
              {playable ? (
                // The browser streams from our API, which checks membership on
                // every request. The file in R2 itself is never public.
                <audio
                  ref={audio}
                  key={track.id}
                  controls
                  autoPlay={started}
                  preload="metadata"
                  src={`/api/stream/${track.id}`}
                  onEnded={() =>
                    current < tracks.length - 1 && select(current + 1)
                  }
                  className="min-w-0 flex-1"
                />
              ) : (
                <button
                  aria-label={t.playLocked}
                  disabled
                  title={t.playLockedTitle}
                  className="grid size-12 place-items-center rounded-full border-2 border-[var(--room-accent)] text-xl disabled:cursor-not-allowed disabled:opacity-70"
                >
                  ▶
                </button>
              )}
              <button
                aria-label={t.next}
                onClick={() => select(current + 1)}
                className="grid size-10 place-items-center rounded-full bg-[var(--room-accent)] text-xl text-[var(--room-accent-text)]"
              >
                ›
              </button>
              {!canPlay && (
                <span className="text-sm opacity-80">
                  {t.opensWithMembership}
                </span>
              )}
            </div>

            {tracks.length > 1 && (
              <ol className="mt-5 divide-y divide-[var(--room-accent)]/30 border-t border-[var(--room-accent)]/30 text-sm">
                {tracks.map((item, index) => (
                  <li key={item.id}>
                    <button
                      onClick={() => select(index)}
                      aria-current={index === current ? "true" : undefined}
                      className={`flex w-full gap-3 py-2 text-left ${index === current ? "font-bold" : "opacity-80 hover:opacity-100"}`}
                    >
                      <span className="w-6 tabular-nums opacity-60">
                        {index + 1}.
                      </span>
                      <span className="truncate">{item.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <h2 className="text-2xl font-bold">{t.empty}</h2>
        )}
      </div>
    </section>
  );
}
