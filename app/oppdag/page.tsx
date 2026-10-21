import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import {
  allBands,
  newestBands,
  POPULAR_DAYS,
  popularBands,
  search,
  type BandCard,
} from "@/lib/discovery";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";

// The discovery room: search results, or newest bands, popular now and A–Å.
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const all = await getT();
  const t = all.discover;
  const query = q.trim().slice(0, 100);

  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-6xl px-5 pb-24 pt-12 md:pt-20">
        <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
          {t.eyebrow}
        </p>
        <h1 className="serif mt-4 text-5xl tracking-[-.08em] md:text-7xl">
          {query ? t.resultsFor(query) : t.title}
        </h1>
        {query ? <Results query={query} t={all} /> : <Lists t={all} />}
      </section>
    </main>
  );
}

async function Results({ query, t: all }: { query: string; t: Dictionary }) {
  const hits = await search(query, 20);
  if (hits.length === 0)
    return <p className="mt-10 text-moss dark:text-stone">{all.search.none}</p>;
  return (
    <ul className="mt-10 divide-y divide-sand border-y border-sand dark:divide-slate/40 dark:border-slate/40">
      {hits.map((hit) => (
        <li key={`${hit.kind}-${hit.id}`}>
          <Link
            href={hit.href}
            className="flex items-baseline justify-between gap-4 py-4 hover:underline"
          >
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold">
                {hit.title}
              </span>
              {hit.kind !== "band" && (
                <span className="block truncate text-sm text-moss dark:text-stone">
                  {all.search.by(hit.bandName)}
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs font-bold uppercase tracking-[.12em] text-pine dark:text-clay">
              {all.search.kinds[hit.kind]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Lists({ t: all }: { t: Dictionary }) {
  const t = all.discover;
  const [newest, popular, everyone] = await Promise.all([
    newestBands(),
    popularBands(),
    allBands(),
  ]);
  if (everyone.length === 0)
    return <p className="mt-10 text-moss dark:text-stone">{t.empty}</p>;
  return (
    <>
      {popular.length > 0 && (
        <Shelf title={t.popular} note={t.popularNote(POPULAR_DAYS)}>
          {popular.map((band) => (
            <Card
              key={band.id}
              band={band}
              meta={t.streams(band.streams ?? 0)}
            />
          ))}
        </Shelf>
      )}
      <Shelf title={t.newest}>
        {newest.map((band) => (
          <Card key={band.id} band={band} />
        ))}
      </Shelf>
      <section className="mt-16">
        <h2 className="text-2xl font-bold">{t.all}</h2>
        <ul className="mt-6 columns-1 gap-8 sm:columns-2 md:columns-3">
          {everyone.map((band) => (
            <li key={band.id} className="break-inside-avoid py-1.5">
              <Link
                href={`/room/${band.slug}`}
                className="font-bold hover:underline"
              >
                {band.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Shelf({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="text-2xl font-bold">{title}</h2>
      {note && <p className="mt-1 text-sm text-moss dark:text-stone">{note}</p>}
      <ul className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
        {children}
      </ul>
    </section>
  );
}

function Card({ band, meta }: { band: BandCard; meta?: string }) {
  return (
    <li>
      <Link href={`/room/${band.slug}`} className="group block">
        <div className="aspect-square overflow-hidden rounded-xl bg-linear-135 from-clay to-sun">
          {band.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={band.avatarUrl}
              alt=""
              className="size-full object-cover transition-transform group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-full place-items-center text-5xl text-white/70"
            >
              ♪
            </span>
          )}
        </div>
        <p className="mt-3 truncate font-bold group-hover:underline">
          {band.name}
        </p>
        {(meta || band.tagline) && (
          <p className="truncate text-sm text-moss dark:text-stone">
            {meta ?? band.tagline}
          </p>
        )}
      </Link>
    </li>
  );
}
