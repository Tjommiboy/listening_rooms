"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { RoomPlayer } from "@/components/RoomPlayer";
import { RoomView } from "@/components/room/RoomView";
import { ColorPicker } from "@/components/studio/ColorPicker";
import type { RoomProfile } from "@/lib/room-profile";
import {
  contrastRatio,
  DEFAULT_THEME,
  effectivePanelColor,
  FONTS,
  MAX_BIO,
  MAX_LINKS,
  MAX_TAGLINE,
  PALETTES,
  PRESETS,
  type PaletteColors,
  type FontId,
  type ImageKind,
  type RoomLink,
  type RoomTheme,
} from "@/lib/room-theme";

type Status = "clean" | "dirty" | "saving" | "saved" | "error";

const MIN_CONTRAST = 4.5; // WCAG AA for normal text

const COLOR_TARGETS = [
  "bgColor",
  "textColor",
  "accentColor",
  "panelColor",
] as const;
type ColorTarget = (typeof COLOR_TARGETS)[number];

export function RoomEditor({
  bandName,
  memberPriceKr,
  initial,
  tracks,
}: {
  bandName: string;
  memberPriceKr: number;
  initial: RoomProfile;
  tracks: { id: string; title: string }[];
}) {
  const all = useT();
  const t = all.editor;
  const [tagline, setTagline] = useState(initial.tagline);
  const [bio, setBio] = useState(initial.bio);
  const [theme, setTheme] = useState<RoomTheme>(initial.theme);
  const [links, setLinks] = useState<RoomLink[]>(initial.links);
  const [images, setImages] = useState({
    avatar: initial.avatarUrl,
    background: initial.backgroundUrl,
  });
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const [status, setStatus] = useState<Status>("clean");
  const [colorTarget, setColorTarget] = useState<ColorTarget>("bgColor");
  const [error, setError] = useState("");

  const touch = () => setStatus("dirty");
  const set = <K extends keyof RoomTheme>(key: K, value: RoomTheme[K]) => {
    setTheme((current) => ({ ...current, [key]: value }));
    touch();
  };

  async function save() {
    setStatus("saving");
    setError("");
    const response = await fetch("/api/studio/room", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagline, bio, theme, links }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      links?: RoomLink[];
    };
    if (!response.ok) {
      setStatus("error");
      setError(data.error ?? all.subscribe.generic);
      return;
    }
    // The server drops invalid links; show what was actually saved.
    if (data.links) setLinks(data.links);
    setStatus("saved");
  }

  async function uploadImage(kind: ImageKind, file: File) {
    setUploading(kind);
    setError("");
    const response = await fetch(`/api/studio/room/image/${kind}`, {
      method: "PUT",
      body: file,
    });
    const data = (await response.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    setUploading(null);
    if (!response.ok || !data.url) {
      setError(data.error ?? all.subscribe.generic);
      return;
    }
    setImages((current) => ({ ...current, [kind]: data.url! }));
  }

  async function removeImage(kind: ImageKind) {
    await fetch(`/api/studio/room/image/${kind}`, { method: "DELETE" });
    setImages((current) => ({ ...current, [kind]: null }));
  }

  // Readability check: text against the boxes and against the bare background.
  const panelContrast = contrastRatio(
    theme.textColor,
    effectivePanelColor(theme),
  );
  const bgContrast = contrastRatio(theme.textColor, theme.bgColor);
  const worst = Math.min(panelContrast, bgContrast);

  const previewProfile: RoomProfile = {
    tagline,
    bio: bio || t.sampleBio,
    theme,
    // Half-typed links (no address yet) aren't shown until they're filled in.
    links: links.filter((link) => link.url.trim()),
    avatarUrl: images.avatar,
    backgroundUrl: images.background,
  };

  const field =
    "mt-1 w-full rounded border border-sand bg-white px-3 py-2 text-ink dark:border-slate/40";
  const label = "block text-sm font-bold";

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[400px_minmax(0,1fr)]">
      {/* ---------------- Controls ---------------- */}
      <div className="space-y-8">
        <Section title={t.presets}>
          <div className="grid grid-cols-5 gap-2">
            {PRESETS.map((preset) => {
              const p = { ...DEFAULT_THEME, ...preset.theme };
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setTheme((current) => ({
                      ...current,
                      ...preset.theme,
                    }));
                    touch();
                  }}
                  className="overflow-hidden rounded border border-sand text-[11px] font-bold dark:border-slate/40"
                  style={{
                    background: p.bgColor,
                    color: p.textColor,
                    fontFamily: FONTS[p.headingFont].stack,
                  }}
                >
                  <span
                    className="block h-2"
                    style={{ background: p.accentColor }}
                  />
                  <span className="block px-1 py-3">
                    {t.presetNames[preset.id] ?? preset.id}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t.sectionProfile}>
          <ImageField
            label={t.avatar}
            url={images.avatar}
            busy={uploading === "avatar"}
            t={t}
            onUpload={(file) => uploadImage("avatar", file)}
            onRemove={() => removeImage("avatar")}
          />
          <label className={`${label} mt-5`} htmlFor="tagline">
            {t.tagline}
          </label>
          <input
            id="tagline"
            value={tagline}
            maxLength={MAX_TAGLINE}
            placeholder={t.taglinePlaceholder}
            onChange={(e) => {
              setTagline(e.target.value);
              touch();
            }}
            className={field}
          />
          <label className={`${label} mt-5`} htmlFor="bio">
            {t.bio}
          </label>
          <textarea
            id="bio"
            value={bio}
            rows={7}
            maxLength={MAX_BIO}
            onChange={(e) => {
              setBio(e.target.value);
              touch();
            }}
            className={field}
          />
          <p className="mt-1 flex justify-between text-xs text-moss dark:text-stone">
            <span>{t.bioHint}</span>
            <span>
              {bio.length} / {MAX_BIO}
            </span>
          </p>
        </Section>

        <Section title={t.palettes}>
          <p className="-mt-1 mb-3 text-xs text-moss dark:text-stone">
            {t.paletteHint}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {PALETTES.map((p) => {
              const active = (
                Object.keys(p.colors) as (keyof PaletteColors)[]
              ).every((key) => theme[key] === p.colors[key]);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setTheme((current) => ({ ...current, ...p.colors }));
                    touch();
                  }}
                  className={`overflow-hidden rounded border text-left text-[11px] font-bold ${active ? "border-2 border-ink dark:border-cream" : "border-sand dark:border-slate/40"}`}
                  style={{
                    background: p.colors.bgColor,
                    color: p.colors.textColor,
                  }}
                >
                  <span className="flex h-5">
                    {(
                      [
                        "bgColor",
                        "panelColor",
                        "accentColor",
                        "textColor",
                      ] as const
                    ).map((key) => (
                      <span
                        key={key}
                        className="flex-1"
                        style={{ background: p.colors[key] }}
                      />
                    ))}
                  </span>
                  <span className="block px-2 py-1.5">
                    {t.paletteNames[p.id] ?? p.id}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t.sectionColors}>
          <p className="text-sm font-bold">{t.pickFor}</p>
          <div role="tablist" className="mt-2 grid grid-cols-4 gap-2">
            {COLOR_TARGETS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={colorTarget === key}
                onClick={() => setColorTarget(key)}
                className={`flex flex-col items-center gap-1 rounded border px-1 py-2 text-xs font-bold ${colorTarget === key ? "border-2 border-ink bg-white/60 dark:border-cream dark:bg-white/10" : "border-sand dark:border-slate/40"}`}
              >
                <span
                  aria-hidden="true"
                  className="size-7 rounded-full border border-black/20"
                  style={{ background: theme[key] }}
                />
                {t[key]}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <ColorPicker
              value={theme[colorTarget]}
              onChange={(hex) => set(colorTarget, hex)}
              labels={t}
            />
          </div>
          <label className={`${label} mt-5`} htmlFor="opacity">
            {t.panelOpacity} ({theme.panelOpacity} %)
          </label>
          <input
            id="opacity"
            type="range"
            min={0}
            max={100}
            value={theme.panelOpacity}
            onChange={(e) => set("panelOpacity", Number(e.target.value))}
            className="mt-2 w-full"
          />
          {worst < MIN_CONTRAST && (
            <p
              role="status"
              className="mt-3 rounded bg-sun/60 px-3 py-2 text-sm text-ink"
            >
              ⚠ {t.lowContrast(worst.toFixed(1))}
            </p>
          )}

          <div className="mt-6">
            <ImageField
              label={t.background}
              url={images.background}
              busy={uploading === "background"}
              t={t}
              onUpload={(file) => uploadImage("background", file)}
              onRemove={() => removeImage("background")}
            />
            {images.background && (
              <fieldset className="mt-3">
                <legend className="text-sm">{t.bgMode}</legend>
                <div className="mt-1 flex gap-4 text-sm">
                  {(["cover", "tile"] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="bgMode"
                        checked={theme.bgMode === mode}
                        onChange={() => set("bgMode", mode)}
                      />
                      {t[mode]}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </Section>

        <Section title={t.sectionFonts}>
          <div className="grid grid-cols-2 gap-4">
            <FontField
              label={t.headingFont}
              value={theme.headingFont}
              onChange={(v) => set("headingFont", v)}
            />
            <FontField
              label={t.bodyFont}
              value={theme.bodyFont}
              onChange={(v) => set("bodyFont", v)}
            />
          </div>
          <fieldset className="mt-5">
            <legend className={label}>{t.layout}</legend>
            <div className="mt-2 space-y-1 text-sm">
              {(["classic", "centered"] as const).map((layout) => (
                <label key={layout} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="layout"
                    checked={theme.layout === layout}
                    onChange={() => set("layout", layout)}
                  />
                  {t[layout]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-5 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={theme.autoplay}
              onChange={(e) => set("autoplay", e.target.checked)}
              className="mt-1"
            />
            <span>
              <strong>{t.autoplay}</strong>
              <br />
              <span className="text-moss dark:text-stone">
                {t.autoplayHint}
              </span>
            </span>
          </label>
        </Section>

        <Section title={t.sectionLinks}>
          <ul className="space-y-3">
            {links.map((link, index) => (
              <li key={index} className="flex gap-2">
                <input
                  aria-label={t.linkLabel}
                  placeholder={t.linkLabel}
                  value={link.label}
                  maxLength={40}
                  onChange={(e) => {
                    const next = [...links];
                    next[index] = { ...link, label: e.target.value };
                    setLinks(next);
                    touch();
                  }}
                  className={`${field} mt-0 w-1/3`}
                />
                <input
                  aria-label={t.linkUrl}
                  placeholder={t.linkUrl}
                  type="url"
                  value={link.url}
                  onChange={(e) => {
                    const next = [...links];
                    next[index] = { ...link, url: e.target.value };
                    setLinks(next);
                    touch();
                  }}
                  className={`${field} mt-0 flex-1`}
                />
                <button
                  type="button"
                  aria-label={t.removeLink}
                  onClick={() => {
                    setLinks(links.filter((_, i) => i !== index));
                    touch();
                  }}
                  className="px-2 text-lg"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {links.length < MAX_LINKS && (
            <button
              type="button"
              onClick={() => setLinks([...links, { label: "", url: "" }])}
              className="mt-3 text-sm font-bold underline"
            >
              {t.addLink}
            </button>
          )}
        </Section>

        <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-4 border-t border-sand bg-paper px-5 py-4 dark:border-slate/40 dark:bg-night">
          <span
            role="status"
            className={`text-sm ${status === "error" ? "text-red-700 dark:text-coral" : "text-moss dark:text-stone"}`}
          >
            {status === "dirty"
              ? t.unsaved
              : status === "saved"
                ? t.saved
                : status === "error"
                  ? error
                  : error}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={status === "saving" || status === "clean"}
            className="bg-ink px-6 py-3 font-bold text-paper disabled:opacity-50 dark:bg-clay dark:text-ink"
          >
            {status === "saving" ? t.saving : t.save}
          </button>
        </div>
      </div>

      {/* ---------------- Live preview ---------------- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
          {t.preview.toUpperCase()}
        </p>
        <div className="h-[75vh] overflow-y-auto rounded-xl border border-sand shadow-xl dark:border-slate/40">
          <RoomView
            name={bandName}
            profile={previewProfile}
            t={all.room}
            fixedBackground={false}
            player={
              <RoomPlayer
                tracks={
                  tracks.length ? tracks : [{ id: "x", title: t.sampleTrack }]
                }
                canPlay
                preview
              />
            }
            membership={
              <>
                <p className="text-4xl font-bold">
                  {memberPriceKr} kr
                  <span className="text-base font-normal opacity-80">
                    {" "}
                    {all.room.perMonth}
                  </span>
                </p>
                <p className="mt-3 text-sm leading-relaxed opacity-90">
                  {all.room.membershipText}
                </p>
                <span className="mt-6 block w-full bg-[#ff5b24] py-3 text-center font-bold text-white">
                  {all.subscribe.join}
                </span>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="border-b border-sand pb-2 text-xs font-bold tracking-[.16em] text-pine dark:border-slate/40 dark:text-clay">
        {title.toUpperCase()}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FontField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FontId;
  onChange: (value: FontId) => void;
}) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FontId)}
        style={{ fontFamily: FONTS[value].stack }}
        className="mt-1 w-full rounded border border-sand bg-white px-2 py-2 font-normal text-ink dark:border-slate/40"
      >
        {(Object.keys(FONTS) as FontId[]).map((id) => (
          <option key={id} value={id} style={{ fontFamily: FONTS[id].stack }}>
            {FONTS[id].label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ImageField({
  label,
  url,
  busy,
  t,
  onUpload,
  onRemove,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  t: {
    upload: string;
    replace: string;
    remove: string;
    uploading: string;
    imageHint: string;
  };
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-bold">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded border border-sand bg-sage dark:border-slate/40 dark:bg-ink">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden="true">🖼</span>
          )}
        </div>
        <label className="cursor-pointer border border-current px-3 py-2 text-sm font-bold focus-within:outline-2">
          {busy ? t.uploading : url ? t.replace : t.upload}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onUpload(file);
            }}
          />
        </label>
        {url && (
          <button
            type="button"
            onClick={onRemove}
            className="text-sm underline"
          >
            {t.remove}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-moss dark:text-stone">{t.imageHint}</p>
    </div>
  );
}
