import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { devLoginEnabled } from "@/lib/demo";
import { safeNext } from "@/lib/redirect";
import { startSession, upsertUser } from "@/lib/session";

// Local testing only: sign in with just a name. Off in production.
export async function POST(request: NextRequest) {
  if (!devLoginEnabled())
    return NextResponse.json(
      { error: (await getT()).errors.notAvailable },
      { status: 404 },
    );
  const form = await request.formData();
  const name = String(form.get("name") ?? "")
    .trim()
    .slice(0, 60);
  const next = safeNext(form.get("next"));
  if (!name)
    return NextResponse.redirect(
      new URL(`/logg-inn?next=${encodeURIComponent(next)}`, request.url),
      303,
    );
  const user = await upsertUser({
    vippsSub: `dev:${name.toLowerCase()}`,
    name,
  });
  await startSession(user.id);
  return NextResponse.redirect(new URL(next, request.url), 303);
}
