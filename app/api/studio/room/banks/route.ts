import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cf";
import { getThemeBanks } from "@/lib/room-profile";
import { BANK_COUNT, parseTheme } from "@/lib/room-theme";
import { requireBandOwner } from "@/lib/storage";

// Stores a look in one of the band's four slots, or empties the slot
// (theme: null). The theme is validated like the room's own theme.
export async function PUT(request: NextRequest) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as {
    slot?: unknown;
    theme?: unknown;
  };
  const slot = Number(body.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot >= BANK_COUNT)
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });

  const banks = await getThemeBanks(ctx.band.id);
  banks[slot] = body.theme === null ? null : parseTheme(body.theme);

  const { DB } = await getEnv();
  await DB.prepare(`UPDATE bands SET theme_banks = ?2 WHERE id = ?1`)
    .bind(ctx.band.id, JSON.stringify(banks))
    .run();
  return NextResponse.json({ banks });
}
