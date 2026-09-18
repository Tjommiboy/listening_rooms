"use client";

import { useState } from "react";

const tracks = ["Night Ferry (Demo)", "Blue Hour — live at home", "After the rain (instrumental)"];

export function RoomPlayer() {
  const [current, setCurrent] = useState(0);
  return <section className="rounded-3xl bg-[#1d2825] p-6 text-[#f8f0e7] shadow-2xl md:grid md:grid-cols-[260px_1fr] md:gap-10 md:p-10">
    <div className="grid min-h-56 place-items-center rounded-2xl bg-[linear-gradient(135deg,#e9a172,#f4d48e)] text-7xl text-white/70">♪</div>
    <div className="mt-8 md:mt-0"><p className="text-xs font-bold tracking-[.16em] text-[#e9a172]">MEMBERS’ RELEASE</p><h2 className="mt-3 text-3xl font-bold">{tracks[current]}</h2><p className="mt-2 text-[#d3cbc1]">Unreleased recording · private stream</p><div className="mt-8 h-1 rounded bg-[#829087]"><div className="h-1 w-1/3 rounded bg-[#e9a172]" /></div><div className="mt-6 flex gap-3"><button aria-label="Previous track" onClick={() => setCurrent((current + tracks.length - 1) % tracks.length)} className="grid size-10 place-items-center rounded-full bg-[#f8f0e7] text-xl text-[#193a35]">‹</button><button aria-label="Play preview" className="grid size-14 place-items-center rounded-full bg-[#e9a172] text-xl text-[#193a35]">▶</button><button aria-label="Next track" onClick={() => setCurrent((current + 1) % tracks.length)} className="grid size-10 place-items-center rounded-full bg-[#f8f0e7] text-xl text-[#193a35]">›</button></div></div>
  </section>;
}
