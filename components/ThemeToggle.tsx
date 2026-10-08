"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/components/I18nProvider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

// The inline script in app/layout.tsx owns the initial `dark` class on <html>;
// this component just mirrors it and lets the visitor override it.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const t = useT();

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage unavailable; the choice just won't persist across visits.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t.nav.themeLight : t.nav.themeDark}
      aria-pressed={dark}
      className="grid size-7 place-items-center rounded-full border border-current/30 text-sm hover:border-current"
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
    </button>
  );
}
