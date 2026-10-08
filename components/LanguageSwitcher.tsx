"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/dictionaries";

const LABELS: Record<Locale, string> = { nb: "NO", en: "EN" };

function saveLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = next;
}

/** NO / EN toggle. Saves the choice in a cookie for a year. */
export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    saveLocale(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={t.nav.language}
      className={`flex shrink-0 overflow-hidden rounded-full border border-current/30 text-[10px] ${pending ? "opacity-60" : ""}`}
    >
      {(Object.keys(LABELS) as Locale[]).map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          onClick={() => choose(option)}
          aria-pressed={option === locale}
          title={option === locale ? undefined : t.nav.switchTo}
          className={`px-2 py-1 ${option === locale ? "bg-current/15" : "opacity-70 hover:opacity-100"}`}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
