"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateBandForm() {
  const router = useRouter();
  const t = useT().studio;
  const generic = useT().subscribe.generic;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/studio/band", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    const data = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(data.error ?? generic);
    router.refresh();
  }

  const field =
    "mt-2 w-full rounded border border-sand bg-white px-3 py-2 text-ink dark:border-slate/40";
  return (
    <form onSubmit={submit} className="mt-10 max-w-md">
      <label className="block text-sm font-bold" htmlFor="band-name">
        {t.bandName}
      </label>
      <input
        id="band-name"
        required
        maxLength={80}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugEdited) setSlug(slugify(e.target.value));
        }}
        className={field}
      />
      <label className="mt-5 block text-sm font-bold" htmlFor="band-slug">
        {t.roomAddress}
      </label>
      <div className="mt-2 flex items-center gap-1 text-sm text-moss dark:text-stone">
        /room/
        <input
          id="band-slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(slugify(e.target.value));
          }}
          className={`${field} mt-0`}
        />
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-coral">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="mt-6 w-full bg-ink py-3 font-bold text-paper disabled:opacity-60 dark:bg-cream dark:text-ink"
      >
        {busy ? t.creating : t.create}
      </button>
    </form>
  );
}
