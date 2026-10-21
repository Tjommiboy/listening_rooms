import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runMonthlyCharges } from "@/lib/billing";

// Creates the month's charges. Called once a day by the Worker's cron trigger
// (see custom-worker.ts), and by hand while testing:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/charges
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Cron not configured." },
      { status: 503 },
    );
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await runMonthlyCharges();
  if (result.errors.length) console.warn("Charge run errors", result.errors);
  return NextResponse.json(result);
}
