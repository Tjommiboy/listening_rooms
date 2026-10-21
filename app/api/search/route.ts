import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/discovery";

// Search bar: bands, albums and songs in live rooms. Public.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const hits = await search(q);
  return NextResponse.json(
    { hits },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
