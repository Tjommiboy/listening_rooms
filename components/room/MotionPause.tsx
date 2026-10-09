"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/I18nProvider";

const KEY = "lr_motion";

// Kept outside the component: these touch the page and browser storage.
function applyMotion(paused: boolean) {
  if (paused) document.documentElement.dataset.motion = "paused";
  else delete document.documentElement.dataset.motion;
}
function readPaused() {
  try {
    return localStorage.getItem(KEY) === "paused";
  } catch {
    return false;
  }
}
function savePaused(paused: boolean) {
  try {
    if (paused) localStorage.setItem(KEY, "paused");
    else localStorage.removeItem(KEY);
  } catch {}
}

/**
 * A small pause button for a breathing background, so visitors can stop the
 * motion (WCAG 2.2.2). The choice is remembered in this browser.
 */
export function MotionPause() {
  const t = useT().room;
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const stored = readPaused();
    applyMotion(stored);
    // Sync with what this visitor chose last time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaused(stored);
    return () => applyMotion(false);
  }, []);

  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => {
        const next = !paused;
        setPaused(next);
        applyMotion(next);
        savePaused(next);
      }}
      className="fixed bottom-4 right-4 z-40 rounded-full border border-[var(--room-accent)] [background:var(--room-panel)] px-3 py-1.5 text-xs font-bold backdrop-blur-sm"
    >
      {paused ? `▶ ${t.motionPlay}` : `⏸ ${t.motionPause}`}
    </button>
  );
}
