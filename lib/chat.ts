import { hasAccess, type Band } from "@/lib/access";
import { isAdmin } from "@/lib/admin";
import { getEnv, newId } from "@/lib/cf";
import {
  CHAT_MAX_PER_WINDOW,
  CHAT_REPLIES,
  CHAT_THREADS,
  CHAT_WINDOW_MS,
  chatDisplayName,
} from "@/lib/chat-rules";
import type { User } from "@/lib/session";

// The chat in a band's room. Who may take part:
// - the band's owner: reads, writes, deletes anything, blocks fans
// - a paying fan (same test as streaming): reads and writes, deletes own
// - a platform admin: reads and deletes (for moderation), does not write
// Everyone else sees nothing. Messages are plain text.

export type ChatRole = "owner" | "admin" | "member";
export type ChatViewer = { userId: string; role: ChatRole; blocked: boolean };

export type ChatMessageView = {
  id: string;
  text: string;
  deleted: boolean;
  createdAt: number;
  authorName: string;
  /** Written by the band itself. */
  isBand: boolean;
  isMine: boolean;
  canDelete: boolean;
  /** Only sent to the band and admins, who need it to block a fan. */
  authorId?: string;
  authorBlocked?: boolean;
};
export type ChatThread = {
  message: ChatMessageView;
  replies: ChatMessageView[];
};

/** The viewer's part in this room's chat, or null if they may not see it. */
export async function getChatViewer(
  user: User | null,
  band: Band,
): Promise<ChatViewer | null> {
  if (!user) return null;
  // The band's owner. A switched-off band is silent, even for its owner.
  if (band.owner_id === user.id)
    return band.disabled_at
      ? null
      : { userId: user.id, role: "owner", blocked: false };
  // A paying fan (hasAccess is false for a disabled or closed room).
  if (await hasAccess(user.id, band)) {
    const { DB } = await getEnv();
    const blocked = await DB.prepare(
      `SELECT 1 FROM chat_blocks WHERE band_id = ?1 AND user_id = ?2`,
    )
      .bind(band.id, user.id)
      .first();
    return { userId: user.id, role: "member", blocked: blocked !== null };
  }
  // Platform admins may read and delete, for moderation.
  if (isAdmin(user)) return { userId: user.id, role: "admin", blocked: false };
  return null;
}

type Row = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: number;
  deleted_at: number | null;
  user_id: string;
  name: string | null;
  blocked: number;
};

const COLUMNS = `m.id, m.parent_id, m.body, m.created_at, m.deleted_at, m.user_id, u.name,
  EXISTS (SELECT 1 FROM chat_blocks k WHERE k.band_id = m.band_id AND k.user_id = m.user_id) AS blocked`;

/** The latest threads, newest first, with their replies oldest first. */
export async function listChat(
  band: Band,
  viewer: ChatViewer,
  fanFallbackName: string,
  limit: number = CHAT_THREADS,
): Promise<{ threads: ChatThread[]; hasMore: boolean }> {
  const { DB } = await getEnv();
  const { results: tops } = await DB.prepare(
    `SELECT ${COLUMNS} FROM chat_messages m JOIN users u ON u.id = m.user_id
      WHERE m.band_id = ?1 AND m.parent_id IS NULL
      ORDER BY m.created_at DESC LIMIT ?2`,
  )
    .bind(band.id, limit + 1)
    .all<Row>();
  // One extra row tells us whether there are older messages.
  const hasMore = tops.length > limit;
  if (hasMore) tops.length = limit;
  const { results: replies } = tops.length
    ? await DB.prepare(
        `SELECT ${COLUMNS} FROM chat_messages m JOIN users u ON u.id = m.user_id
          WHERE m.band_id = ?1 AND m.deleted_at IS NULL
            AND m.parent_id IN (SELECT value FROM json_each(?2))
          ORDER BY m.created_at ASC LIMIT ?3`,
      )
        .bind(band.id, JSON.stringify(tops.map((t) => t.id)), CHAT_REPLIES)
        .all<Row>()
    : { results: [] as Row[] };

  const staff = viewer.role === "owner" || viewer.role === "admin";
  const view = (row: Row): ChatMessageView => {
    const isBand = row.user_id === band.owner_id;
    const deleted = row.deleted_at !== null;
    return {
      id: row.id,
      text: deleted ? "" : row.body,
      deleted,
      createdAt: row.created_at,
      authorName: isBand
        ? band.name
        : chatDisplayName(row.name, fanFallbackName),
      isBand,
      isMine: row.user_id === viewer.userId,
      canDelete: !deleted && (staff || row.user_id === viewer.userId),
      ...(staff && !isBand
        ? { authorId: row.user_id, authorBlocked: row.blocked === 1 }
        : {}),
    };
  };

  const threads = tops
    .map((top) => ({
      message: view(top),
      replies: replies.filter((r) => r.parent_id === top.id).map(view),
    }))
    // A deleted first message only stays if there are replies under it.
    .filter((thread) => !thread.message.deleted || thread.replies.length > 0);
  return { threads, hasMore };
}

export type PostResult =
  { ok: true } | { ok: false; error: "too_fast" | "parent_gone" };

export async function postChatMessage(input: {
  band: Band;
  userId: string;
  text: string;
  parentId: string | null;
}): Promise<PostResult> {
  const { DB } = await getEnv();
  const recent = await DB.prepare(
    `SELECT COUNT(*) AS n FROM chat_messages
      WHERE band_id = ?1 AND user_id = ?2 AND created_at > ?3`,
  )
    .bind(input.band.id, input.userId, Date.now() - CHAT_WINDOW_MS)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= CHAT_MAX_PER_WINDOW)
    return { ok: false, error: "too_fast" };

  if (input.parentId) {
    // Replies go under a first message that still exists in this room.
    const parent = await DB.prepare(
      `SELECT id FROM chat_messages
        WHERE id = ?1 AND band_id = ?2 AND parent_id IS NULL AND deleted_at IS NULL`,
    )
      .bind(input.parentId, input.band.id)
      .first();
    if (!parent) return { ok: false, error: "parent_gone" };
  }

  await DB.prepare(
    `INSERT INTO chat_messages (id, band_id, user_id, parent_id, body, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(
      newId("msg"),
      input.band.id,
      input.userId,
      input.parentId,
      input.text,
      Date.now(),
    )
    .run();
  return { ok: true };
}

/** Returns false if there is nothing this viewer may delete with that id. */
export async function deleteChatMessage(input: {
  band: Band;
  viewer: ChatViewer;
  messageId: string;
}) {
  const { DB } = await getEnv();
  const staff = input.viewer.role === "owner" || input.viewer.role === "admin";
  const row = await DB.prepare(
    `UPDATE chat_messages SET deleted_at = ?4, deleted_by = ?3
      WHERE id = ?1 AND band_id = ?2 AND deleted_at IS NULL
        AND (?5 = 1 OR user_id = ?3)
      RETURNING id`,
  )
    .bind(
      input.messageId,
      input.band.id,
      input.viewer.userId,
      Date.now(),
      staff ? 1 : 0,
    )
    .first();
  return row !== null;
}

/** Block or unblock a fan from writing. The band's owner can't be blocked. */
export async function setChatBlocked(input: {
  band: Band;
  fanId: string;
  blocked: boolean;
  byUserId: string;
}) {
  if (input.fanId === input.band.owner_id) return false;
  const { DB } = await getEnv();
  const known = await DB.prepare(`SELECT id FROM users WHERE id = ?1`)
    .bind(input.fanId)
    .first();
  if (!known) return false;
  if (input.blocked)
    await DB.prepare(
      `INSERT INTO chat_blocks (band_id, user_id, blocked_at, blocked_by)
       VALUES (?1, ?2, ?3, ?4) ON CONFLICT DO NOTHING`,
    )
      .bind(input.band.id, input.fanId, Date.now(), input.byUserId)
      .run();
  else
    await DB.prepare(
      `DELETE FROM chat_blocks WHERE band_id = ?1 AND user_id = ?2`,
    )
      .bind(input.band.id, input.fanId)
      .run();
  return true;
}
