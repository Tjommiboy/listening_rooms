import { NextRequest, NextResponse } from "next/server";
import {
  bandSummaries,
  currentMonth,
  monthRange,
  trackReport,
} from "@/lib/reports";
import { requireBandOwner } from "@/lib/storage";

// Listening stats and TONO estimate for the signed-in band, for one month.
export async function GET(request: NextRequest) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;
  const month = request.nextUrl.searchParams.get("month") ?? currentMonth();
  if (!monthRange(month))
    return NextResponse.json({ error: "Bad month" }, { status: 400 });
  const rows = await trackReport(month, ctx.band.id);
  const [summary] = await bandSummaries(month, rows);
  return NextResponse.json({ month, rows, summary: summary ?? null });
}
