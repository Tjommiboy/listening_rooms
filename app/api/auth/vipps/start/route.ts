import { NextRequest, NextResponse } from "next/server";
import { appOrigin, safeNext } from "@/lib/redirect";
import { authorizationUrl, vippsLoginConfigured } from "@/lib/vipps-login";

const STATE_COOKIE = "lr_login_state";

// Sends the visitor to Vipps to sign in. `?next=/room/x` brings them back.
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (!vippsLoginConfigured())
    return NextResponse.redirect(
      new URL(
        `/logg-inn?feil=vipps&next=${encodeURIComponent(next)}`,
        request.url,
      ),
    );
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const redirectUri = `${appOrigin(request.nextUrl.origin)}/api/auth/vipps/callback`;
  const response = NextResponse.redirect(
    await authorizationUrl({ redirectUri, state, nonce }),
  );
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/vipps",
    maxAge: 600,
  });
  return response;
}
