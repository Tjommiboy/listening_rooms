"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";

export default function StudioPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [connectState, setConnectState] = useState<"idle" | "loading" | "ready" | "pending" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const account = new URLSearchParams(window.location.search).get("stripe_account");
    if (!account) return;
    fetch(`/api/connect/status?account=${encodeURIComponent(account)}`)
      .then((response) => response.json())
      .then((data: { chargesEnabled?: boolean; payoutsEnabled?: boolean; error?: string }) => {
        if (data.error) throw new Error(data.error);
        if (data.chargesEnabled && data.payoutsEnabled) {
          setConnectState("ready"); setMessage("Stripe payouts are connected. Your room can accept paid members once subscriptions are enabled.");
        } else {
          setConnectState("pending"); setMessage("Stripe is reviewing or still needs information. Return to Stripe if it asks for more details.");
        }
      }).catch((error: Error) => { setConnectState("error"); setMessage(error.message); });
  }, []);

  async function connectStripe() {
    setConnectState("loading"); setMessage("");
    try {
      const response = await fetch("/api/connect/onboard", { method: "POST" });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Unable to start Stripe onboarding.");
      window.location.assign(data.url);
    } catch (error) {
      setConnectState("error"); setMessage(error instanceof Error ? error.message : "Unable to start Stripe onboarding.");
    }
  }
  return <main className="min-h-screen bg-[#f3eee6]"><Navigation />
    <section className="mx-auto max-w-4xl px-5 py-16"><p className="text-xs font-bold tracking-[.16em] text-[#277263]">CREATOR STUDIO · PREVIEW</p><h1 className="serif mt-4 text-6xl tracking-[-.08em] md:text-7xl">Build your room.</h1><p className="mt-5 max-w-xl leading-relaxed text-[#536b66]">File selection works locally. Stripe payout onboarding can be tested with a Stripe test key; secure uploads and storage allocation are the next backend phase.</p>
      <div className="mt-12 grid gap-6 md:grid-cols-2"><label className="rounded-xl border-2 border-dashed border-[#abc0b3] bg-[#d7e1d7] p-10 text-center hover:border-[#277263]"><input className="hidden" type="file" accept="audio/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><span className="text-4xl">↑</span><strong className="mt-4 block">Choose recordings</strong><span className="mt-2 block text-sm text-[#536b66]">Audio files only · 10 GB plan limit</span></label><div className="rounded-xl bg-[#193a35] p-8 text-[#f3eee6]"><p className="text-xs font-bold tracking-[.16em] text-[#b0d4bf]">YOUR PLAN</p><p className="mt-5 text-4xl font-bold">49 kr <span className="text-base font-normal text-[#c6d1cc]">/ month</span></p><p className="mt-4 text-sm leading-relaxed text-[#c6d1cc]">10 GB storage · 10% platform fee on fan subscriptions.</p><button onClick={connectStripe} disabled={connectState === "loading" || connectState === "ready"} className="mt-6 w-full bg-[#e9a172] py-3 font-bold text-[#193a35] disabled:opacity-60">{connectState === "loading" ? "Opening Stripe…" : connectState === "ready" ? "Payouts connected" : "Connect payouts with Stripe →"}</button>{message && <p className={`mt-4 text-sm leading-relaxed ${connectState === "error" ? "text-[#ffb4a0]" : "text-[#c6d1cc]"}`}>{message}</p>}</div></div>
      <section className="mt-8 rounded-xl border border-[#d5cabe] bg-white/40 p-7"><div className="flex justify-between"><h2 className="text-xl font-bold">Selected recordings</h2><span className="text-sm text-[#536b66]">{files.length} chosen</span></div>{files.length === 0 ? <p className="mt-5 text-[#536b66]">Choose audio files to preview your upload list.</p> : <ul className="mt-5 divide-y divide-[#d5cabe]">{files.map(file => <li key={`${file.name}-${file.lastModified}`} className="flex justify-between gap-4 py-3"><span className="truncate">{file.name}</span><span className="shrink-0 text-sm text-[#536b66]">{(file.size / 1024 / 1024).toFixed(1)} MB</span></li>)}</ul>}</section>
      <Link href="/room/anand" className="mt-8 inline-block font-bold underline">View the example artist room →</Link>
    </section>
  </main>;
}
