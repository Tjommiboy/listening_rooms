"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/I18nProvider";
import type { Booklet, Credit } from "@/lib/albums";

/** Groups credits by role: "Gitar: Kari, Ola". Keeps the band's order. */
function groupCredits(credits: Credit[]) {
  const groups: { role: string; names: string[] }[] = [];
  for (const { role, name } of credits) {
    const existing = groups.find((g) => g.role === role);
    if (existing) existing.names.push(name);
    else groups.push({ role, names: [name] });
  }
  return groups;
}

function CreditList({ credits }: { credits: Credit[] }) {
  if (credits.length === 0) return null;
  return (
    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
      {groupCredits(credits).map((group, i) => (
        <div key={i} className="contents">
          <dt className="break-words font-bold opacity-80">{group.role}</dt>
          <dd className="min-w-0 break-words">
            {group.names.filter(Boolean).join(", ")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The album booklet as members see it: a picture gallery (with a full-size
 * viewer), liner notes, credits for the album and for each song, and lyrics.
 * Everything is plain text written by the band.
 */
export function BookletView({
  booklet,
  songs,
}: {
  booklet: Booklet;
  songs: { id: string; title: string }[];
}) {
  const t = useT().booklet;
  const [viewing, setViewing] = useState<number | null>(null);
  const images = booklet.images;

  useEffect(() => {
    if (viewing === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewing(null);
      if (e.key === "ArrowRight")
        setViewing((v) => (v === null ? v : (v + 1) % images.length));
      if (e.key === "ArrowLeft")
        setViewing((v) =>
          v === null ? v : (v - 1 + images.length) % images.length,
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing, images.length]);

  const heading = { fontFamily: "var(--room-heading-font)" };

  return (
    <div className="space-y-6 border-t border-[var(--room-accent)]/40 p-5">
      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setViewing(index)}
                className="block w-full overflow-hidden rounded border border-[var(--room-accent)]/50"
                aria-label={
                  image.caption || t.picture(index + 1, images.length)
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.caption}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {booklet.notes && (
        <p className="whitespace-pre-line break-words leading-relaxed">
          {booklet.notes}
        </p>
      )}

      {booklet.credits.length > 0 && (
        <section>
          <h3
            style={heading}
            className="mb-2 text-sm font-bold uppercase tracking-[.12em]"
          >
            {t.credits}
          </h3>
          <CreditList credits={booklet.credits} />
        </section>
      )}

      {songs.some(
        (s) =>
          booklet.tracks[s.id]?.credits.length || booklet.tracks[s.id]?.notes,
      ) && (
        <ol className="space-y-5">
          {songs.map((song, index) => {
            const part = booklet.tracks[song.id];
            if (!part || (!part.credits.length && !part.notes)) return null;
            return (
              <li key={song.id}>
                <h3 style={heading} className="font-bold">
                  {index + 1}. {song.title}
                </h3>
                <div className="mt-2 space-y-2">
                  <CreditList credits={part.credits} />
                  {part.notes && (
                    <p className="whitespace-pre-line break-words text-sm italic opacity-90">
                      {part.notes}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {viewing !== null && images[viewing] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.picture(viewing + 1, images.length)}
          onClick={() => setViewing(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 text-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[viewing].url}
            alt={images[viewing].caption}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-full rounded object-contain"
          />
          <p className="mt-3 text-center text-sm">
            {images[viewing].caption}
            <span className="ml-3 opacity-60">
              {t.picture(viewing + 1, images.length)}
            </span>
          </p>
          <div className="mt-3 flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label={t.previous}
              onClick={() =>
                setViewing((viewing - 1 + images.length) % images.length)
              }
              className="rounded-full border border-white/60 px-4 py-1"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={t.close}
              onClick={() => setViewing(null)}
              className="rounded-full border border-white/60 px-4 py-1"
            >
              ✕
            </button>
            <button
              type="button"
              aria-label={t.next}
              onClick={() => setViewing((viewing + 1) % images.length)}
              className="rounded-full border border-white/60 px-4 py-1"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
