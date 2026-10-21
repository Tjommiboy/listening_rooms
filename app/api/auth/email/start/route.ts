import { NextRequest, NextResponse } from "next/server";
import { devLoginEnabled } from "@/lib/demo";
import { sendEmail } from "@/lib/email";
import { createLoginToken, normalizeEmail } from "@/lib/email-login";
import { getT } from "@/lib/i18n/server";
import { appOrigin, safeNext } from "@/lib/redirect";

// Email login for people outside Norway: sends a one-time link.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const next = safeNext(form.get("next"));
  const email = normalizeEmail(form.get("email"));
  const back = (query: string) =>
    NextResponse.redirect(
      new URL(
        `/logg-inn?next=${encodeURIComponent(next)}&${query}`,
        request.url,
      ),
      303,
    );
  if (!email) return back("feil=epost");

  const token = await createLoginToken(email, next);
  // Too many links: answer as if sent, so the form can't be used to probe.
  if (!token) return back(`sendt=${encodeURIComponent(email)}`);

  const link = `${appOrigin(request.nextUrl.origin)}/logg-inn/epost?token=${token}`;
  const t = await getT();
  try {
    await sendEmail({
      to: email,
      subject: t.email.subject,
      text: t.email.body(link),
    });
  } catch (error) {
    console.error("Login email failed", error);
    return back("feil=epost");
  }
  const dev = devLoginEnabled() ? `&lenke=${encodeURIComponent(link)}` : "";
  return back(`sendt=${encodeURIComponent(email)}${dev}`);
}
