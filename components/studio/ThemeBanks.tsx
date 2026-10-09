"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useT } from "@/components/I18nProvider";
import { api } from "@/lib/upload-client";
import {
  BANK_COUNT,
  fill,
  hexToRgba,
  type RoomTheme,
  type ThemeBanks as Banks,
} from "@/lib/room-theme";

/** A tiny picture of a look: background, a box and an accent bar. */
function Swatch({ theme }: { theme: RoomTheme }) {
  const panel = fill(
    hexToRgba(theme.panelColor, Math.max(theme.panelOpacity, 60)),
    theme.panelGradient,
    theme.panelGradient
      ? hexToRgba(theme.panelGradient.color, Math.max(theme.panelOpacity, 60))
      : undefined,
  );
  return (
    <span
      aria-hidden="true"
      className="block h-14 p-2"
      style={{ background: fill(theme.bgColor, theme.bgGradient) }}
    >
      <span
        className="block h-full overflow-hidden"
        style={{
          background: panel,
          borderRadius: Math.min(theme.radius, 8),
        }}
      >
        <span
          className="block h-2"
          style={{ background: fill(theme.accentColor, theme.accentGradient) }}
        />
        <span
          className="mx-1.5 mt-1.5 block h-1 w-2/3 rounded-full"
          style={{ background: theme.textColor }}
        />
      </span>
    </span>
  );
}

const same = (a: RoomTheme | null, b: RoomTheme) =>
  a !== null && JSON.stringify(a) === JSON.stringify(b);

/**
 * Four slots for the band's own looks. Click a slot (or use the arrow keys)
 * to flick through them; the store button saves the current look into the
 * selected slot. Loading a look only changes the editor: the room changes
 * when the band presses Save.
 */
export function ThemeBanks({
  initial,
  theme,
  onLoad,
}: {
  initial: Banks;
  theme: RoomTheme;
  onLoad: (theme: RoomTheme) => void;
}) {
  const t = useT().editor;
  const [banks, setBanks] = useState<Banks>(initial);
  const [slot, setSlot] = useState(() =>
    Math.max(
      0,
      initial.findIndex((bank) => same(bank, theme)),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    setSlot(index);
    setMessage("");
    const bank = banks[index];
    if (bank && !same(bank, theme)) onLoad(bank);
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      e.key
    ];
    if (!step) return;
    e.preventDefault();
    const next = (slot + step + BANK_COUNT) % BANK_COUNT;
    select(next);
    buttons.current[next]?.focus();
  }

  async function store() {
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ banks: Banks }>("/api/studio/room/banks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, theme }),
      });
      setBanks(data.banks);
      setMessage(t.storedInSlot(slot + 1));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const current = banks[slot];
  const changed = current !== null && !same(current, theme);

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={t.sectionBanks}
        onKeyDown={onKeyDown}
        className="grid grid-cols-4 gap-2"
      >
        {banks.map((bank, index) => (
          <button
            key={index}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={slot === index}
            tabIndex={slot === index ? 0 : -1}
            onClick={() => select(index)}
            className={`overflow-hidden rounded border text-left text-xs font-bold ${slot === index ? "border-2 border-ink dark:border-cream" : "border-sand dark:border-slate/40"}`}
          >
            {bank ? (
              <Swatch theme={bank} />
            ) : (
              <span className="grid h-14 place-items-center bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgba(0,0,0,.05)_6px_12px)] text-moss dark:text-stone">
                {t.bankEmpty}
              </span>
            )}
            <span className="block px-2 py-1">{t.bankSlot(index + 1)}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={store}
          disabled={busy || same(current, theme)}
          className="border border-current px-3 py-1.5 text-sm font-bold disabled:opacity-40"
        >
          {current ? t.replaceSlot(slot + 1) : t.storeInSlot(slot + 1)}
        </button>
        <span role="status" className="text-xs text-moss dark:text-stone">
          {message || (changed ? t.changedSinceStored : "")}
        </span>
      </div>
    </div>
  );
}
