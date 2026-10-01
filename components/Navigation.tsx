import Link from "next/link";

export function Navigation({ dark = false }: { dark?: boolean }) {
  const color = dark ? "text-cream" : "text-ink";
  return (
    <nav
      className={`mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 ${color}`}
    >
      <Link href="/" className="text-xs font-black tracking-[0.16em]">
        LISTENING ROOMS
      </Link>
      <div className="flex gap-5 text-xs font-bold">
        <Link href="/artists">For artists</Link>
        <Link href="/studio">Creator studio</Link>
      </div>
    </nav>
  );
}
