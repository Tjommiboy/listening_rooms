import { NextRequest, NextResponse } from "next/server";
import { getBandBySlug } from "@/lib/access";
import { getEnv } from "@/lib/cf";
import { createReport, recentReportCount } from "@/lib/content-reports";
import { sendEmail } from "@/lib/email";
import { getT } from "@/lib/i18n/server";
import { appOrigin } from "@/lib/redirect";
import {
  parseReport,
  REPORTS_PER_HOUR,
  slugFromRoomText,
} from "@/lib/report-rules";
import { getCurrentUser } from "@/lib/session";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// The public report form. Anyone can report, no login needed. The report is
// saved first; the email to support is a bonus and may fail without harm.
export async function POST(request: NextRequest) {
  const t = await getT();
  const body = (await request.json().catch(() => null)) as
    (Record<string, unknown> & { trackId?: unknown }) | null;
  const parsed = parseReport(body);
  if (!parsed.ok) {
    const message = {
      category: t.errors.reportInvalid,
      description: t.errors.reportDescription,
      email: t.errors.emailInvalid,
    }[parsed.error];
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const draft = parsed.value;

  // Limit spam per visitor. Only a hash of the address is kept, for this.
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "";
  const ipHash = ip ? await sha256(ip) : null;
  if (
    ipHash &&
    (await recentReportCount(ipHash, Date.now() - 3_600_000)) >=
      REPORTS_PER_HOUR
  )
    return NextResponse.json(
      { error: t.errors.tooManyReports },
      { status: 429 },
    );

  // Match the room (and song) the reporter named, if we can.
  const slug = slugFromRoomText(draft.room);
  const band = slug ? await getBandBySlug(slug) : null;
  let trackId: string | null = null;
  if (band && typeof body?.trackId === "string") {
    const { DB } = await getEnv();
    const track = await DB.prepare(
      `SELECT id FROM tracks WHERE id = ?1 AND band_id = ?2 AND deleted_at IS NULL`,
    )
      .bind(body.trackId.slice(0, 100), band.id)
      .first<{ id: string }>();
    trackId = track?.id ?? null;
  }

  const user = await getCurrentUser();
  const id = await createReport({
    draft,
    bandId: band?.id ?? null,
    trackId,
    userId: user?.id ?? null,
    ipHash,
  });

  const support = process.env.SUPPORT_EMAIL;
  if (support) {
    try {
      await sendEmail({
        to: support,
        subject: `Report ${id}: ${draft.category}${band ? ` – ${band.name}` : ""}`,
        text: [
          `Category: ${draft.category}`,
          `Room: ${band ? `${band.name} (/room/${band.slug})` : draft.room || "-"}`,
          `Song: ${draft.song || "-"}`,
          `From: ${draft.name || "-"} <${draft.email || "no email"}>`,
          "",
          draft.description,
          "",
          `${appOrigin(request.nextUrl.origin)}/admin/rapporter`,
        ].join("\n"),
      });
    } catch (error) {
      console.error("Report email failed", id, error);
    }
  }
  return NextResponse.json({ ok: true });
}
