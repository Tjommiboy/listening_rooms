import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/email-login";
import { safeNext } from "@/lib/redirect";
import { EMAIL_SUB_PREFIX, startSession, upsertUser } from "@/lib/session";

// The "Log in" button on /logg-inn/epost posts here with the link's token.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const found = await consumeLoginToken(String(form.get("token") ?? ""));
  if (!found)
    return NextResponse.redirect(
      new URL("/logg-inn?feil=lenke", request.url),
      303,
    );
  const user = await upsertUser({
    vippsSub: `${EMAIL_SUB_PREFIX}${found.email}`,
    email: found.email,
  });
  await startSession(user.id);
  return NextResponse.redirect(new URL(safeNext(found.next), request.url), 303);
}
