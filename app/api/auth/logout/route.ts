import { NextRequest, NextResponse } from "next/server";
import { endSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  await endSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
