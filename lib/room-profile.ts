import { getEnv } from "@/lib/cf";
import {
  parseBanks,
  parseLinks,
  parseTheme,
  type ImageKind,
  type RoomLink,
  type RoomTheme,
  type ThemeBanks,
} from "@/lib/room-theme";

export type RoomProfile = {
  tagline: string;
  bio: string;
  theme: RoomTheme;
  links: RoomLink[];
  avatarUrl: string | null;
  backgroundUrl: string | null;
};

type Row = {
  tagline: string | null;
  bio: string | null;
  theme: string | null;
  links: string | null;
  avatar_key: string | null;
  background_key: string | null;
  profile_updated_at: number | null;
};

export function imageUrl(bandId: string, kind: ImageKind, version: number) {
  return `/api/media/${bandId}/${kind}?v=${version}`;
}

export async function getRoomProfile(bandId: string): Promise<RoomProfile> {
  const { DB } = await getEnv();
  const row = await DB.prepare(
    `SELECT tagline, bio, theme, links, avatar_key, background_key, profile_updated_at
       FROM bands WHERE id = ?1`,
  )
    .bind(bandId)
    .first<Row>();
  const version = row?.profile_updated_at ?? 0;
  return {
    tagline: row?.tagline ?? "",
    bio: row?.bio ?? "",
    theme: parseTheme(row?.theme),
    links: parseLinks(row?.links),
    avatarUrl: row?.avatar_key ? imageUrl(bandId, "avatar", version) : null,
    backgroundUrl: row?.background_key
      ? imageUrl(bandId, "background", version)
      : null,
  };
}

/** The band's four saved looks (empty slots are null). */
export async function getThemeBanks(bandId: string): Promise<ThemeBanks> {
  const { DB } = await getEnv();
  const row = await DB.prepare(`SELECT theme_banks FROM bands WHERE id = ?1`)
    .bind(bandId)
    .first<{ theme_banks: string | null }>();
  return parseBanks(row?.theme_banks);
}
