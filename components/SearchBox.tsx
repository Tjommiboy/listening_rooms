"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";
import type { SearchHit } from "@/lib/discovery";

/**
 * The search bar in the top bar: bands, albums and songs in live rooms.
 * Results appear as you type; Enter opens the highlighted hit, or the full
 * results page when nothing is highlighted.
 */
export function SearchBox() {
  const t = useT().search;
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((response) => response.json() as Promise<{ hits?: SearchHit[] }>)
        .then((data) => {
          setHits(data.hits ?? []);
          setActive(-1);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close when clicking outside.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const showList = open && query.trim().length >= 2;
  // Old results are hidden (not cleared) when the query gets too short.
  const shown = showList ? hits : [];

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <form
      ref={boxRef}
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const hit = shown.at(active);
        if (active >= 0 && hit) go(hit.href);
        else if (query.trim())
          go(`/oppdag?q=${encodeURIComponent(query.trim())}`);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        {t.label}
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        value={query}
        placeholder={t.placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => Math.min(i + 1, shown.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, -1));
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-40 rounded-full border border-current/30 bg-transparent px-3 py-1.5 text-xs font-normal placeholder:text-current/60 focus:w-56 focus:border-current focus:outline-none md:w-48"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.label}
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border border-sand bg-paper text-ink shadow-xl dark:border-slate/40 dark:bg-night dark:text-cream"
        >
          {shown.length === 0 ? (
            <li className="px-4 py-3 text-sm text-moss dark:text-stone">
              {t.none}
            </li>
          ) : (
            shown.map((hit, i) => (
              <li
                key={`${hit.kind}-${hit.id}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(event) => {
                  event.preventDefault();
                  go(hit.href);
                }}
                onPointerEnter={() => setActive(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 text-sm ${i === active ? "bg-sage dark:bg-ink" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{hit.title}</span>
                  {hit.kind !== "band" && (
                    <span className="block truncate text-xs font-normal text-moss dark:text-stone">
                      {t.by(hit.bandName)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-[.12em] text-pine dark:text-clay">
                  {t.kinds[hit.kind]}
                </span>
              </li>
            ))
          )}
          {shown.length > 0 && (
            <li
              role="presentation"
              className="border-t border-sand dark:border-slate/40"
            >
              <button
                type="submit"
                className="w-full px-4 py-2.5 text-left text-xs font-bold underline"
                onPointerDown={() => setActive(-1)}
              >
                {t.seeAll}
              </button>
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
