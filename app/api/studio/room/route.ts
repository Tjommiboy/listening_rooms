import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cf";
import { getT } from "@/lib/i18n/server";
import {
  cleanBandName,
  MAX_BIO,
  MAX_TAGLINE,
  parseLinks,
  parseTheme,
} from "@/lib/room-theme";
import { requireBandOwner } from "@/lib/storage";

// Saves the band's room look and texts. Everything is validated against a
// fixed set of options (lib/room-theme.ts); unknown values fall back to
// defaults, and text is stored as plain text (never rendered as HTML).
export async function PUT(request: NextRequest) {
  const ctx = await requireBandOwner();
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    tagline?: unknown;
    bio?: unknown;
    theme?: unknown;
    links?: unknown;
  };
  const tagline =
    typeof body.tagline === "string"
      ? body.tagline.trim().slice(0, MAX_TAGLINE)
      : "";
  const bio =
    typeof body.bio === "string"
      ? body.bio.replace(/\r\n/g, "\n").trim().slice(0, MAX_BIO)
      : "";
  // The name can change any time; the room's address (slug) stays the same,
  // so links fans already have keep working. Older clients may leave it out.
  const name =
    body.name === undefined ? ctx.band.name : cleanBandName(body.name);
  if (!name)
    return NextResponse.json(
      { error: (await getT()).errors.bandNameRequired },
      { status: 400 },
    );
  const theme = parseTheme(body.theme);
  const links = parseLinks(body.links);

  const { DB } = await getEnv();
  await DB.prepare(
    `UPDATE bands
        SET tagline = ?2, bio = ?3, theme = ?4, links = ?5, profile_updated_at = ?6,
            name = ?7
      WHERE id = ?1`,
  )
    .bind(
      ctx.band.id,
      tagline,
      bio,
      JSON.stringify(theme),
      JSON.stringify(links),
      Date.now(),
      name,
    )
    .run();
  return NextResponse.json({ name, tagline, bio, theme, links });
}
