"use client";

import { useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import type { Album, Booklet } from "@/lib/albums";
import { BookletEditor } from "@/components/studio/BookletEditor";
import { formatNumber } from "@/lib/i18n/dictionaries";
import {
  api,
  naturalSort,
  titleFromFilename,
  uploadFile,
} from "@/lib/upload-client";

type Track = {
  id: string;
  title: string;
  size_bytes: number;
  writers?: string | null;
};
type Progress = { name: string; sent: number; total: number; error?: string };

/**
 * The band's music library in Studio: upload single songs or a whole album,
 * rename and delete songs, and build albums from any songs.
 */
export function Library({
  canUpload,
  initialTracks,
  initialAlbums,
  initialBooklets,
  usedBytes,
  quotaBytes,
}: {
  canUpload: boolean;
  initialTracks: Track[];
  initialAlbums: Album[];
  initialBooklets: Record<string, Booklet>;
  usedBytes: number;
  quotaBytes: number;
}) {
  const all = useT();
  const t = all.studio;
  const l = all.library;
  const locale = useLocale();
  const gb = (bytes: number) => formatNumber(locale, bytes / 1024 ** 3, 2);
  const mb = (bytes: number) => formatNumber(locale, bytes / 1024 ** 2, 1);

  const [tracks, setTracks] = useState(initialTracks);
  const [albums, setAlbums] = useState(initialAlbums);
  const [used, setUsed] = useState(usedBytes);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [mode, setMode] = useState<"songs" | "album">("songs");
  const [albumTitle, setAlbumTitle] = useState("");
  const [error, setError] = useState("");
  const busy = progress.some((p) => p.sent < p.total && !p.error);

  /** Uploads files one by one; returns the new track ids in order. */
  async function uploadAll(files: File[], stripNumbers: boolean) {
    setProgress(files.map((f) => ({ name: f.name, sent: 0, total: f.size })));
    const ids: string[] = [];
    for (const [i, file] of files.entries()) {
      const update = (patch: Partial<Progress>) =>
        setProgress((list) =>
          list.map((p, j) => (j === i ? { ...p, ...patch } : p)),
        );
      try {
        const track = await uploadFile(
          file,
          (sent) => update({ sent }),
          stripNumbers ? titleFromFilename(file.name) : undefined,
        );
        ids.push(track.trackId);
        setTracks((list) => [
          ...list,
          { id: track.trackId, title: track.title, size_bytes: track.size },
        ]);
        setUsed((u) => u + track.size);
        update({ sent: file.size });
      } catch (err) {
        update({ error: err instanceof Error ? err.message : t.error });
      }
    }
    return ids;
  }

  async function uploadAlbum(files: File[]) {
    setError("");
    const title = albumTitle.trim();
    if (!title) return setError(all.errors.albumTitleRequired);
    try {
      // Create the album first, then fill it as the songs arrive.
      const album = await api<Album>("/api/studio/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setAlbums((list) => [...list, album]);
      const ids = await uploadAll(naturalSort(files), true);
      const saved = await api<{ trackIds: string[] }>(
        `/api/studio/albums/${album.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackIds: ids }),
        },
      );
      setAlbums((list) =>
        list.map((a) =>
          a.id === album.id ? { ...a, trackIds: saved.trackIds } : a,
        ),
      );
      setAlbumTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  }

  async function removeTrack(track: Track) {
    if (!window.confirm(l.confirmDeleteTrack(track.title))) return;
    await api(`/api/studio/tracks/${track.id}`, { method: "DELETE" });
    setTracks((list) => list.filter((x) => x.id !== track.id));
    setAlbums((list) =>
      list.map((a) => ({
        ...a,
        trackIds: a.trackIds.filter((id) => id !== track.id),
      })),
    );
    setUsed((u) => u - track.size_bytes);
  }

  async function renameTrack(track: Track, title: string) {
    const saved = await api<{ title: string }>(
      `/api/studio/tracks/${track.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      },
    );
    setTracks((list) =>
      list.map((x) => (x.id === track.id ? { ...x, title: saved.title } : x)),
    );
  }

  const disabled = !canUpload || busy;
  const tab = (active: boolean) =>
    `px-4 py-2 text-sm font-bold ${active ? "bg-ink text-paper dark:bg-clay dark:text-ink" : "opacity-70 hover:opacity-100"}`;

  return (
    <div>
      {/* ---------- Upload ---------- */}
      <div
        role="tablist"
        className="mb-3 inline-flex overflow-hidden rounded-full border border-sand dark:border-slate/40"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "songs"}
          onClick={() => setMode("songs")}
          className={tab(mode === "songs")}
        >
          {l.modeSongs}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "album"}
          onClick={() => setMode("album")}
          className={tab(mode === "album")}
        >
          {l.modeAlbum}
        </button>
      </div>

      {mode === "album" && (
        <label className="mb-3 block text-sm font-bold">
          {l.albumTitle}
          <input
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
            maxLength={120}
            placeholder={l.albumTitlePlaceholder}
            className="mt-1 w-full rounded border border-sand bg-white px-3 py-2 font-normal text-ink dark:border-slate/40"
          />
        </label>
      )}

      <label
        aria-disabled={disabled}
        className={`block rounded-xl border-2 border-dashed border-fern bg-sage p-10 text-center dark:border-slate/40 dark:bg-ink ${!disabled ? "cursor-pointer hover:border-pine focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pine dark:hover:border-clay dark:focus-within:outline-clay" : "cursor-not-allowed opacity-60"}`}
      >
        <input
          className="sr-only"
          type="file"
          accept="audio/*"
          multiple
          disabled={disabled}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (!files.length) return;
            if (mode === "album") void uploadAlbum(files);
            else void uploadAll(files, false);
          }}
        />
        <span aria-hidden="true" className="text-4xl">
          {mode === "album" ? "💿" : "↑"}
        </span>
        <strong className="mt-4 block">
          {!canUpload
            ? t.activatePlan
            : mode === "album"
              ? l.chooseAlbumFiles
              : t.upload}
        </strong>
        <span className="mt-2 block text-sm text-moss dark:text-stone">
          {mode === "album"
            ? l.albumFilesHint
            : t.usage(gb(used), gb(quotaBytes))}
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-coral">
          {error}
        </p>
      )}

      {progress.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm" aria-live="polite">
          {progress.map((p, i) => (
            <li key={`${i}-${p.name}`}>
              <div className="flex justify-between gap-4">
                <span className="truncate">{p.name}</span>
                <span
                  className={
                    p.error
                      ? "text-red-700 dark:text-coral"
                      : "text-moss dark:text-stone"
                  }
                >
                  {p.error ??
                    (p.sent >= p.total
                      ? t.done
                      : `${Math.round((p.sent / p.total) * 100)} %`)}
                </span>
              </div>
              <progress className="mt-1 w-full" max={p.total} value={p.sent} />
            </li>
          ))}
        </ul>
      )}

      {/* ---------- Songs ---------- */}
      <section className="mt-8 rounded-xl border border-sand bg-white/40 p-7 dark:border-slate/40 dark:bg-white/5">
        <h2 className="text-xl font-bold">
          {l.songsTitle}{" "}
          <span className="text-sm font-normal text-moss dark:text-stone">
            ({tracks.length})
          </span>
        </h2>
        {tracks.length === 0 ? (
          <p className="mt-5 text-moss dark:text-stone">{t.noTracks}</p>
        ) : (
          <ul className="mt-5 divide-y divide-sand dark:divide-slate/40">
            {tracks.map((track) => (
              <SongRow
                key={track.id}
                track={track}
                size={`${mb(track.size_bytes)} MB`}
                onRename={(title) => renameTrack(track, title)}
                onDelete={() => removeTrack(track)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Albums ---------- */}
      <Albums
        tracks={tracks}
        albums={albums}
        setAlbums={setAlbums}
        booklets={initialBooklets}
      />
    </div>
  );
}

function SongRow({
  track,
  size,
  onRename,
  onDelete,
}: {
  track: Track;
  size: string;
  onRename: (title: string) => Promise<void>;
  onDelete: () => void;
}) {
  const all = useT();
  const l = all.library;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(track.title);
  const [error, setError] = useState("");

  if (editing)
    return (
      <li className="py-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await onRename(title);
              setEditing(false);
              setError("");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error");
            }
          }}
        >
          <input
            autoFocus
            value={title}
            maxLength={120}
            aria-label={l.rename}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 flex-1 rounded border border-sand bg-white px-2 py-1 text-ink dark:border-slate/40"
          />
          <button className="text-sm font-bold underline">{l.save}</button>
          <button
            type="button"
            onClick={() => {
              setTitle(track.title);
              setEditing(false);
            }}
            className="text-sm underline"
          >
            {l.cancel}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-700 dark:text-coral">
            {error}
          </p>
        )}
      </li>
    );

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <span className="truncate">{track.title}</span>
      <span className="flex shrink-0 items-center gap-4 text-sm text-moss dark:text-stone">
        {size}
        <button onClick={() => setEditing(true)} className="underline">
          {l.rename}
        </button>
        <button
          onClick={onDelete}
          className="font-bold text-red-700 underline dark:text-coral"
        >
          {all.studio.delete}
        </button>
      </span>
    </li>
  );
}

function Albums({
  tracks,
  albums,
  setAlbums,
  booklets,
}: {
  tracks: Track[];
  albums: Album[];
  booklets: Record<string, Booklet>;
  setAlbums: React.Dispatch<React.SetStateAction<Album[]>>;
}) {
  const all = useT();
  const l = all.library;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const album = await api<Album>("/api/studio/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setAlbums((list) => [...list, album]);
      setOpen(album.id);
      setTitle("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-sand bg-white/40 p-7 dark:border-slate/40 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{l.albumsTitle}</h2>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-sm font-bold underline"
          >
            {l.newAlbum}
          </button>
        )}
      </div>
      {creating && (
        <form onSubmit={create} className="mt-4 flex flex-wrap gap-2">
          <input
            autoFocus
            value={title}
            maxLength={120}
            aria-label={l.albumTitle}
            placeholder={l.albumTitlePlaceholder}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 flex-1 rounded border border-sand bg-white px-3 py-2 text-ink dark:border-slate/40"
          />
          <button className="bg-ink px-4 py-2 text-sm font-bold text-paper dark:bg-clay dark:text-ink">
            {l.create}
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="px-2 text-sm underline"
          >
            {l.cancel}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-coral">
          {error}
        </p>
      )}
      {albums.length === 0 && !creating ? (
        <p className="mt-5 text-moss dark:text-stone">{l.noAlbums}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              tracks={tracks}
              booklet={booklets[album.id]}
              open={open === album.id}
              onToggle={() => setOpen(open === album.id ? null : album.id)}
              onChange={(next) =>
                setAlbums((list) =>
                  list.map((a) => (a.id === album.id ? next : a)),
                )
              }
              onDelete={() =>
                setAlbums((list) => list.filter((a) => a.id !== album.id))
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AlbumCard({
  album,
  tracks,
  booklet,
  open,
  onToggle,
  onChange,
  onDelete,
}: {
  album: Album;
  tracks: Track[];
  booklet: Booklet | undefined;
  open: boolean;
  onToggle: () => void;
  onChange: (album: Album) => void;
  onDelete: () => void;
}) {
  const all = useT();
  const l = all.library;
  const e = all.editor;
  const [title, setTitle] = useState(album.title);
  const [description, setDescription] = useState(album.description);
  const [adding, setAdding] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const byId = new Map(tracks.map((t) => [t.id, t]));
  const inAlbum = album.trackIds.filter((id) => byId.has(id));
  const notInAlbum = tracks.filter((t) => !album.trackIds.includes(t.id));

  async function save(patch: {
    title?: string;
    description?: string;
    trackIds?: string[];
  }) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ trackIds?: string[] }>(
        `/api/studio/albums/${album.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      onChange({
        ...album,
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description.trim() }
          : {}),
        trackIds: result.trackIds ?? album.trackIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const move = (index: number, delta: number) => {
    const next = [...inAlbum];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    void save({ trackIds: next });
  };

  async function uploadCover(file: File) {
    setError("");
    try {
      const { url } = await api<{ url: string }>(
        `/api/studio/albums/${album.id}/cover`,
        { method: "PUT", body: file },
      );
      onChange({ ...album, coverUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function removeCover() {
    await api(`/api/studio/albums/${album.id}/cover`, { method: "DELETE" });
    onChange({ ...album, coverUrl: null });
  }

  async function remove() {
    if (!window.confirm(l.confirmDeleteAlbum(album.title))) return;
    await api(`/api/studio/albums/${album.id}`, { method: "DELETE" });
    onDelete();
  }

  const field =
    "mt-1 w-full rounded border border-sand bg-white px-3 py-2 font-normal text-ink dark:border-slate/40";
  const small = "px-2 text-base leading-none disabled:opacity-30";

  return (
    <li className="rounded-lg border border-sand dark:border-slate/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-3 text-left"
      >
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded bg-sage dark:bg-ink">
          {album.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={album.coverUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span aria-hidden="true" className="text-2xl">
              💿
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate">{album.title}</strong>
          <span className="text-sm text-moss dark:text-stone">
            {l.songsInAlbum(inAlbum.length)}
          </span>
        </span>
        <span className="text-sm font-bold underline">
          {open ? l.close : l.open}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-sand p-4 dark:border-slate/40">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="text-sm font-bold">
              {l.albumTitle}
              <input
                value={title}
                maxLength={120}
                onChange={(ev) => setTitle(ev.target.value)}
                onBlur={() =>
                  title.trim() !== album.title && void save({ title })
                }
                className={field}
              />
            </label>
            <div className="text-sm font-bold">
              {l.cover}
              <div className="mt-1 flex items-center gap-3">
                <label className="cursor-pointer border border-current px-3 py-2 text-sm">
                  {album.coverUrl ? e.replace : e.upload}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="sr-only"
                    onChange={(ev) => {
                      const file = ev.target.files?.[0];
                      ev.target.value = "";
                      if (file) void uploadCover(file);
                    }}
                  />
                </label>
                {album.coverUrl && (
                  <button
                    type="button"
                    onClick={removeCover}
                    className="text-sm font-normal underline"
                  >
                    {e.remove}
                  </button>
                )}
              </div>
            </div>
          </div>
          <label className="block text-sm font-bold">
            {l.description}
            <textarea
              value={description}
              rows={3}
              maxLength={2000}
              onChange={(ev) => setDescription(ev.target.value)}
              onBlur={() =>
                description.trim() !== album.description &&
                void save({ description })
              }
              className={field}
            />
          </label>

          <div>
            {inAlbum.length === 0 ? (
              <p className="text-sm text-moss dark:text-stone">
                {l.emptyAlbum}
              </p>
            ) : (
              <ol className="divide-y divide-sand rounded border border-sand dark:divide-slate/40 dark:border-slate/40">
                {inAlbum.map((id, index) => (
                  <li key={id} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-6 text-sm tabular-nums opacity-60">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {byId.get(id)?.title}
                    </span>
                    <button
                      type="button"
                      aria-label={l.moveUp}
                      title={l.moveUp}
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                      className={small}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={l.moveDown}
                      title={l.moveDown}
                      disabled={busy || index === inAlbum.length - 1}
                      onClick={() => move(index, 1)}
                      className={small}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={l.removeFromAlbum}
                      title={l.removeFromAlbum}
                      disabled={busy}
                      onClick={() =>
                        void save({
                          trackIds: inAlbum.filter((x) => x !== id),
                        })
                      }
                      className={small}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <fieldset>
            <legend className="text-sm font-bold">{l.addSongs}</legend>
            {notInAlbum.length === 0 ? (
              <p className="mt-1 text-sm text-moss dark:text-stone">
                {l.allAdded}
              </p>
            ) : (
              <>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                  {notInAlbum.map((track) => (
                    <label key={track.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={adding.includes(track.id)}
                        onChange={(ev) =>
                          setAdding((list) =>
                            ev.target.checked
                              ? [...list, track.id]
                              : list.filter((x) => x !== track.id),
                          )
                        }
                      />
                      {track.title}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy || adding.length === 0}
                  onClick={async () => {
                    await save({ trackIds: [...inAlbum, ...adding] });
                    setAdding([]);
                  }}
                  className="mt-3 bg-ink px-4 py-2 text-sm font-bold text-paper disabled:opacity-40 dark:bg-clay dark:text-ink"
                >
                  {l.add}
                  {adding.length > 0 ? ` (${adding.length})` : ""}
                </button>
              </>
            )}
          </fieldset>

          <BookletEditor
            albumId={album.id}
            songs={inAlbum.flatMap((id) => {
              const song = byId.get(id);
              return song ? [song] : [];
            })}
            initial={booklet}
          />

          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-coral">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={remove}
            className="text-sm font-bold text-red-700 underline dark:text-coral"
          >
            {l.deleteAlbum}
          </button>
        </div>
      )}
    </li>
  );
}
