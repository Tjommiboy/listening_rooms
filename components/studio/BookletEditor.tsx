"use client";

import { useId, useState } from "react";
import { useT } from "@/components/I18nProvider";
import type { Booklet, BookletImage, Credit } from "@/lib/albums";
import { api } from "@/lib/upload-client";

type Song = { id: string; title: string; writers?: string | null };

/**
 * Edits an album's booklet: pictures (saved as soon as they're added),
 * liner notes, album credits and per-song credits and lyrics (saved with
 * the Save button).
 */
export function BookletEditor({
  albumId,
  songs,
  initial,
}: {
  albumId: string;
  songs: Song[];
  initial: Booklet | undefined;
}) {
  const t = useT().booklet;
  const [images, setImages] = useState<BookletImage[]>(initial?.images ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [credits, setCredits] = useState<Credit[]>(initial?.credits ?? []);
  const [trackParts, setTrackParts] = useState(initial?.tracks ?? {});
  const [openSong, setOpenSong] = useState<string | null>(null);
  const [status, setStatus] = useState<"clean" | "dirty" | "saving" | "saved">(
    "clean",
  );
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(0);
  const rolesId = useId();

  const dirty = () => setStatus("dirty");
  const songPart = (id: string) => trackParts[id] ?? { credits: [], notes: "" };
  const setSongPart = (
    id: string,
    patch: Partial<{ credits: Credit[]; notes: string }>,
  ) => {
    setTrackParts((all) => ({ ...all, [id]: { ...songPart(id), ...patch } }));
    dirty();
  };

  async function save() {
    setStatus("saving");
    setError("");
    try {
      // Only send songs that are on the album right now.
      const tracks = Object.fromEntries(
        songs.map((s) => [s.id, songPart(s.id)]),
      );
      await api(`/api/studio/albums/${albumId}/booklet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, credits, tracks }),
      });
      setStatus("saved");
    } catch (err) {
      setStatus("dirty");
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function addImages(files: File[]) {
    setError("");
    setUploading(files.length);
    for (const file of files) {
      try {
        const image = await api<BookletImage>(
          `/api/studio/albums/${albumId}/images`,
          { method: "POST", body: file },
        );
        setImages((list) => [...list, image]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
        break;
      } finally {
        setUploading((n) => n - 1);
      }
    }
    setUploading(0);
  }

  async function moveImage(index: number, delta: number) {
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setImages(next);
    await api(`/api/studio/albums/${albumId}/images`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((i) => i.id) }),
    }).catch(() => {});
  }

  async function saveCaption(image: BookletImage, caption: string) {
    await api(`/api/studio/albums/${albumId}/images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption }),
    }).catch(() => {});
  }

  async function removeImage(image: BookletImage) {
    await api(`/api/studio/albums/${albumId}/images/${image.id}`, {
      method: "DELETE",
    }).catch(() => {});
    setImages((list) => list.filter((i) => i.id !== image.id));
  }

  const field =
    "mt-1 w-full rounded border border-sand bg-white px-3 py-2 font-normal text-ink dark:border-slate/40";

  return (
    <div className="rounded-lg border-2 border-dashed border-sand p-4 dark:border-slate/40">
      <h3 className="text-lg font-bold">📖 {t.title}</h3>
      <p className="text-sm text-moss dark:text-stone">{t.intro}</p>
      <datalist id={rolesId}>
        {t.roles.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>

      {/* Pictures */}
      <section className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold">{t.pictures}</h4>
          <label className="cursor-pointer border border-current px-3 py-1.5 text-sm font-bold">
            {uploading ? `${uploading} …` : t.addPictures}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              disabled={uploading > 0}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) void addImages(files);
              }}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-moss dark:text-stone">
          {t.picturesHint}
        </p>
        {images.length === 0 ? (
          <p className="mt-3 text-sm text-moss dark:text-stone">
            {t.noPictures}
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image, index) => (
              <li
                key={image.id}
                className="overflow-hidden rounded border border-sand dark:border-slate/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.caption}
                  className="aspect-square w-full object-cover"
                />
                <div className="p-2">
                  <input
                    defaultValue={image.caption}
                    aria-label={t.caption}
                    placeholder={t.caption}
                    maxLength={300}
                    onBlur={(e) => {
                      const caption = e.target.value;
                      if (caption === image.caption) return;
                      setImages((list) =>
                        list.map((i) =>
                          i.id === image.id ? { ...i, caption } : i,
                        ),
                      );
                      void saveCaption(image, caption);
                    }}
                    className="w-full rounded border border-sand bg-white px-2 py-1 text-xs text-ink dark:border-slate/40"
                  />
                  <div className="mt-1 flex justify-between text-sm">
                    <span>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveImage(index, -1)}
                        aria-label="←"
                        className="px-1 disabled:opacity-30"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={index === images.length - 1}
                        onClick={() => moveImage(index, 1)}
                        aria-label="→"
                        className="px-1 disabled:opacity-30"
                      >
                        →
                      </button>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeImage(image)}
                      className="text-xs text-red-700 underline dark:text-coral"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Liner notes */}
      <label className="mt-6 block text-sm font-bold">
        {t.notes}
        <textarea
          value={notes}
          rows={6}
          maxLength={20000}
          onChange={(e) => {
            setNotes(e.target.value);
            dirty();
          }}
          className={field}
        />
      </label>
      <p className="mt-1 text-xs text-moss dark:text-stone">{t.notesHint}</p>

      {/* Album credits */}
      <section className="mt-6">
        <h4 className="text-sm font-bold">{t.albumCredits}</h4>
        <CreditsEditor
          credits={credits}
          rolesId={rolesId}
          onChange={(next) => {
            setCredits(next);
            dirty();
          }}
        />
      </section>

      {/* Per-song credits */}
      {songs.length > 0 && (
        <section className="mt-6">
          <h4 className="text-sm font-bold">{t.songCredits}</h4>
          <ol className="mt-2 divide-y divide-sand rounded border border-sand dark:divide-slate/40 dark:border-slate/40">
            {songs.map((song, index) => {
              const part = songPart(song.id);
              const open = openSong === song.id;
              return (
                <li key={song.id}>
                  <button
                    type="button"
                    onClick={() => setOpenSong(open ? null : song.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  >
                    <span className="w-6 tabular-nums opacity-60">
                      {index + 1}.
                    </span>
                    <span className="flex-1 truncate font-bold">
                      {song.title}
                    </span>
                    <span className="text-xs opacity-70">
                      {part.credits.length > 0
                        ? `${part.credits.length} ✓`
                        : ""}
                      {part.notes ? " ✎" : ""} {open ? "▲" : "▼"}
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-3 px-3 pb-4">
                      {song.writers && (
                        <p className="text-xs text-moss dark:text-stone">
                          {t.writersFromRights(song.writers)}
                        </p>
                      )}
                      <CreditsEditor
                        credits={part.credits}
                        rolesId={rolesId}
                        onChange={(next) =>
                          setSongPart(song.id, { credits: next })
                        }
                      />
                      <label className="block text-sm font-bold">
                        {t.lyrics}
                        <textarea
                          value={part.notes}
                          rows={5}
                          maxLength={10000}
                          onChange={(e) =>
                            setSongPart(song.id, { notes: e.target.value })
                          }
                          className={field}
                        />
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-coral">
          {error}
        </p>
      )}
      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving" || status === "clean"}
          className="bg-ink px-4 py-2 text-sm font-bold text-paper disabled:opacity-40 dark:bg-clay dark:text-ink"
        >
          {status === "saving" ? t.saving : t.save}
        </button>
        <span role="status" className="text-sm text-moss dark:text-stone">
          {status === "saved" ? t.saved : status === "dirty" ? t.unsaved : ""}
        </span>
      </div>
    </div>
  );
}

function CreditsEditor({
  credits,
  rolesId,
  onChange,
}: {
  credits: Credit[];
  rolesId: string;
  onChange: (credits: Credit[]) => void;
}) {
  const t = useT().booklet;
  const update = (index: number, patch: Partial<Credit>) =>
    onChange(credits.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const input =
    "min-w-0 rounded border border-sand bg-white px-2 py-1.5 text-sm text-ink dark:border-slate/40";

  return (
    <div className="mt-2 space-y-2">
      {credits.map((credit, index) => (
        <div key={index} className="flex gap-2">
          <input
            list={rolesId}
            value={credit.role}
            maxLength={60}
            aria-label={t.role}
            placeholder={t.role}
            onChange={(e) => update(index, { role: e.target.value })}
            className={`${input} w-2/5`}
          />
          <input
            value={credit.name}
            maxLength={200}
            aria-label={t.name}
            placeholder={t.name}
            onChange={(e) => update(index, { name: e.target.value })}
            className={`${input} flex-1`}
          />
          <button
            type="button"
            aria-label={t.removeCredit}
            title={t.removeCredit}
            onClick={() => onChange(credits.filter((_, i) => i !== index))}
            className="px-2"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...credits, { role: "", name: "" }])}
        className="text-sm font-bold underline"
      >
        {t.addCredit}
      </button>
    </div>
  );
}
