import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { RoomPlayer } from "@/components/RoomPlayer";

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = slug === "anand" ? "Anand" : slug.replace(/-/g, " ");
  return <main className="min-h-screen bg-[#f3eee6]"><Navigation />
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pt-24"><p className="text-xs font-bold tracking-[.16em] text-[#277263]">ARTIST LISTENING ROOM</p><h1 className="serif mt-4 text-6xl capitalize tracking-[-.08em] md:text-8xl">{name}&apos;s room.</h1><p className="mt-6 max-w-lg text-lg leading-relaxed text-[#536b66]">A small private archive of demos, live sessions, and recordings made for close listeners.</p></section>
    <div className="mx-auto max-w-6xl px-5"><RoomPlayer /></div>
    <section className="mx-auto grid max-w-6xl gap-8 px-5 py-20 md:grid-cols-[1fr_330px]"><div><p className="text-xs font-bold tracking-[.16em] text-[#277263]">IN THIS ROOM</p><h2 className="serif mt-3 text-5xl tracking-[-.07em]">Beyond the release.</h2><p className="mt-5 max-w-xl leading-relaxed text-[#536b66]">Membership makes space for the unfinished, the intimate, and the recordings that never needed to fit a public-release cycle.</p></div><aside className="rounded-lg border border-[#d5cabe] bg-white/40 p-7"><p className="text-xs font-bold tracking-[.16em] text-[#277263]">MEMBERSHIP</p><p className="mt-5 text-4xl font-bold">19 kr<span className="text-base font-normal text-[#536b66]"> / month</span></p><p className="mt-4 text-sm leading-relaxed text-[#536b66]">Full access to this artist&apos;s private recordings. Cancel anytime.</p><button className="mt-6 w-full bg-[#193a35] py-3 font-bold text-[#f3eee6]">Become a member →</button></aside></section>
    <p className="mx-auto max-w-6xl px-5 pb-10 text-sm text-[#536b66]">Demo route: <Link className="underline" href="/artists">create an artist room</Link>.</p>
  </main>;
}
