import type { CSSProperties } from "react";
import { breathColors, type RoomTheme } from "@/lib/room-theme";

/**
 * The room's "Pust": a slow, living layer between the background (color or
 * picture) and the content. Pure CSS (see .lr-breath in globals.css): only
 * opacity and transform animate, so it costs almost no CPU.
 */
export function BreathLayer({
  theme,
  fixed,
}: {
  theme: RoomTheme;
  /** Cover the screen (live room) or just the parent box (editor preview). */
  fixed: boolean;
}) {
  if (theme.breath === "off") return null;
  const [a, b] = breathColors(theme);
  const style = {
    position: fixed ? "fixed" : "absolute",
    "--breath-speed": `${theme.breathSpeed}s`,
    "--breath-max": theme.breathStrength / 100,
  } as CSSProperties;

  return (
    <div aria-hidden="true" className="lr-breath" style={style}>
      {theme.breath === "fade" && (
        <div
          className="lr-breath-fade"
          style={{
            background: `radial-gradient(circle at 25% 20%, ${a}, transparent 60%), radial-gradient(circle at 80% 85%, ${b}, transparent 55%)`,
          }}
        />
      )}
      {theme.breath === "drift" && (
        <div
          className="lr-breath-drift"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${a}, transparent 35%), radial-gradient(circle at 65% 60%, ${b}, transparent 40%)`,
          }}
        />
      )}
      {theme.breath === "blobs" &&
        [
          { color: a, top: "-10%", left: "-10%", speed: 1 },
          { color: b, top: "40%", left: "55%", speed: 1.35 },
          { color: a, top: "70%", left: "5%", speed: 0.8 },
        ].map((blob, i) => (
          <div
            key={i}
            className="lr-breath-blob"
            style={{
              background: blob.color,
              top: blob.top,
              left: blob.left,
              animationDuration: `calc(var(--breath-speed) * ${blob.speed})`,
              animationDelay: `calc(var(--breath-speed) * ${-i * 0.4})`,
            }}
          />
        ))}
    </div>
  );
}
