import { NextRequest, NextResponse } from "next/server";
import { appOrigin, safeNext } from "@/lib/redirect";
import { startSession, upsertUser } from "@/lib/session";
import { exchangeCode } from "@/lib/vipps-login";

const STATE_COOKIE = "lr_login_state";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get(STATE_COOKIE)?.value ?? "{}");
  } catch {}
  const next = safeNext(saved.next);
  const fail = () =>
    NextResponse.redirect(
      new URL(
        `/logg-inn?feil=vipps&next=${encodeURIComponent(next)}`,
        request.url,
      ),
    );

  const code = params.get("code");
  if (!code || !saved.state || params.get("state") !== saved.state)
    return fail();

  try {
    const info = await exchangeCode({
      code,
      redirectUri: `${appOrigin(request.nextUrl.origin)}/api/auth/vipps/callback`,
    });
    const user = await upsertUser({
      vippsSub: info.sub,
      name: info.name,
      phone: info.phone_number,
      email: info.email,
    });
    await startSession(user.id);
  } catch (error) {
    console.error("Vipps Login failed", error);
    return fail();
  }
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/vipps" });
  return response;
}
