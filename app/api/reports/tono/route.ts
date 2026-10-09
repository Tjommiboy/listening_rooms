import { NextRequest, NextResponse } from "next/server";
import { getBandByOwner } from "@/lib/access";
import { isAdmin } from "@/lib/admin";
import {
  bandSummaries,
  currentMonth,
  monthRange,
  summaryCsv,
  trackReport,
  tracksCsv,
} from "@/lib/reports";
import { getCurrentUser } from "@/lib/session";

// Monthly usage report as CSV.
//   ?month=2026-10            which month (Norwegian time)
//   ?type=tracks|summary      per track (what TONO needs) or per band
//   ?scope=band|all           your own band, or every band (admins only)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const params = request.nextUrl.searchParams;
  const month = params.get("month") ?? currentMonth();
  if (!monthRange(month)) return new NextResponse("Bad month", { status: 400 });
  const type = params.get("type") === "summary" ? "summary" : "tracks";

  let bandId: string | null;
  let label: string;
  if (params.get("scope") === "all") {
    if (!isAdmin(user)) return new NextResponse("Forbidden", { status: 403 });
    bandId = null;
    label = "alle-band";
  } else {
    const band = await getBandByOwner(user.id);
    if (!band) return new NextResponse("No band", { status: 403 });
    bandId = band.id;
    label = band.slug;
  }

  const rows = await trackReport(month, bandId);
  const csv =
    type === "summary"
      ? summaryCsv(month, await bandSummaries(month, rows))
      : tracksCsv(month, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tono-${label}-${month}-${type}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
