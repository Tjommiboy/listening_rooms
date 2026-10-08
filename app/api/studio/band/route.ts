import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getBandByOwner, type Band } from "@/lib/access";
import { getEnv, newId } from "@/lib/cf";
import { getCurrentUser } from "@/lib/session";
import { ensureBandBucket } from "@/lib/storage";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

// Creates the signed-in user's band, its room and its own private R2 bucket
// (in the Listening Rooms Cloudflare account; the band never sees it).
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: (await getT()).errors.loginFirst },
      { status: 401 },
    );
  if (await getBandByOwner(user.id))
    return NextResponse.json(
      { error: (await getT()).errors.alreadyBand },
      { status: 409 },
    );

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    slug?: unknown;
  };
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const slug =
    typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!name)
    return NextResponse.json(
      { error: (await getT()).errors.bandNameRequired },
      { status: 400 },
    );
  if (!SLUG.test(slug))
    return NextResponse.json(
      {
        error: (await getT()).errors.slugInvalid,
      },
      { status: 400 },
    );

  const { DB } = await getEnv();
  const id = newId("band");
  try {
    await DB.prepare(
      "INSERT INTO bands (id, slug, name, owner_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
      .bind(id, slug, name, user.id, Date.now())
      .run();
  } catch {
    return NextResponse.json(
      { error: (await getT()).errors.slugTaken },
      { status: 409 },
    );
  }

  const band: Band = {
    id,
    slug,
    name,
    owner_id: user.id,
    member_price_kr: 19,
    bucket_name: null,
  };
  try {
    await ensureBandBucket(band);
  } catch (error) {
    // The room still works; the bucket is created again on the first upload.
    console.error("Could not create band bucket", error);
  }
  return NextResponse.json({ id, slug, bucket: band.bucket_name });
}
