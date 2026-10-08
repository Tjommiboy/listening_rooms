import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export async function Navigation({
  dark = false,
  themed = false,
}: {
  dark?: boolean;
  /** Inside a band room: use the room's own text color. */
  themed?: boolean;
}) {
  const color = themed
    ? "text-[var(--room-text)]"
    : dark
      ? "text-cream"
      : "text-ink dark:text-cream";
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  return (
    <nav
      className={`mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-6 ${color}`}
    >
      <Link
        href="/"
        className="whitespace-nowrap text-xs font-black tracking-[0.16em]"
      >
        LISTENING ROOMS
      </Link>
      <div className="flex items-center gap-4 whitespace-nowrap text-xs font-bold md:gap-5">
        <Link href="/artists">{t.nav.forBands}</Link>
        <Link href="/studio">{t.nav.studio}</Link>
        {user ? (
          <form method="post" action="/api/auth/logout">
            <button title={user.name ?? undefined}>{t.nav.logout}</button>
          </form>
        ) : (
          <Link href="/logg-inn">{t.nav.login}</Link>
        )}
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </nav>
  );
}
