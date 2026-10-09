"use client";

import { useEffect, type RefObject } from "react";

const HEARTBEAT_MS = 15_000;

function send(body: object, beacon: boolean) {
  const json = JSON.stringify(body);
  // sendBeacon survives page close; fetch+keepalive is the fallback.
  if (
    beacon &&
    navigator.sendBeacon?.(
      "/api/plays",
      new Blob([json], { type: "application/json" }),
    )
  )
    return;
  fetch("/api/plays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Reports how long a track was actually listened to. Counts real playback
 * time only (skipping ahead or scrubbing doesn't add seconds), sends a
 * heartbeat while playing and a final report on pause, end or page close.
 */
export function useListenTracker(
  audio: RefObject<HTMLAudioElement | null>,
  trackId: string | undefined,
  enabled: boolean,
) {
  useEffect(() => {
    const el = audio.current;
    if (!el || !trackId || !enabled) return;

    let playId: string | null = null;
    let heard = 0;
    let last: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const report = (beacon = false) => {
      if (!playId) return;
      send(
        {
          playId,
          trackId,
          seconds: Math.floor(heard),
          duration: Number.isFinite(el.duration) ? el.duration : undefined,
        },
        beacon,
      );
    };
    const stopTimer = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onPlay = () => {
      if (!playId) {
        playId = crypto.randomUUID();
        heard = 0;
        report();
      }
      last = el.currentTime;
      stopTimer();
      timer = setInterval(() => report(), HEARTBEAT_MS);
    };
    const onTime = () => {
      if (el.paused || last === null) return;
      const delta = el.currentTime - last;
      // Normal playback moves forward in small steps; bigger jumps are seeks.
      if (delta > 0 && delta < 2) heard += delta;
      last = el.currentTime;
    };
    const onSeek = () => {
      last = el.currentTime;
    };
    const onPause = () => {
      stopTimer();
      report(true);
    };
    const onEnded = () => {
      stopTimer();
      report(true);
      playId = null; // playing it again later is a new play
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") report(true);
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onSeek);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPause);
    return () => {
      stopTimer();
      report(true);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onSeek);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPause);
    };
  }, [audio, trackId, enabled]);
}
