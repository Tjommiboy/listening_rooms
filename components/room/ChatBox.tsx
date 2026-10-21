"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/components/I18nProvider";
import type { ChatMessageView, ChatRole, ChatThread } from "@/lib/chat";
import { CHAT_MAX_LENGTH } from "@/lib/chat-rules";

// The chat inside a band's room. Colors come from the room theme (CSS
// variables set by RoomView). Messages are plain text. Not real-time: new
// messages show after "Load new" or after you write something yourself.

async function call(url: string, init: RequestInit, fallback: string) {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? fallback);
}

const json = { "Content-Type": "application/json" };
const accentButton =
  "min-h-11 px-4 text-sm font-bold [background:var(--room-accent-fill)] text-[var(--room-accent-text)] disabled:opacity-50";
const plainButton =
  "min-h-11 border border-current px-4 text-sm font-bold disabled:opacity-50";
const linkButton = "min-h-8 text-xs font-bold underline underline-offset-2";

export function ChatBox({
  slug,
  threads,
  moreHref,
  role,
  blocked,
}: {
  slug: string;
  threads: ChatThread[];
  /** Link that shows 50 older threads, or null when there are no more. */
  moreHref: string | null;
  role: ChatRole;
  /** The band has turned off this member's writing. */
  blocked: boolean;
}) {
  const router = useRouter();
  const t = useT().chat;
  const canWrite = role !== "admin" && !blocked;
  const [replyTo, setReplyTo] = useState<string | null>(null);

  return (
    <div id="chat">
      <p className="text-sm opacity-80">
        {role === "admin" ? t.adminNote : t.intro}
      </p>

      {canWrite && (
        <Composer
          slug={slug}
          parentId={null}
          label={t.label}
          onDone={() => router.refresh()}
        />
      )}
      {blocked && (
        <p role="status" className="mt-4 text-sm font-bold">
          {t.blockedNote}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button onClick={() => router.refresh()} className={linkButton}>
          {t.refresh}
        </button>
      </div>

      {threads.length === 0 ? (
        <p className="mt-2 opacity-80">{t.empty}</p>
      ) : (
        <ol className="mt-2 divide-y divide-current/20">
          {threads.map((thread) => (
            <li key={thread.message.id} className="py-4">
              <Message
                slug={slug}
                message={thread.message}
                role={role}
                onReply={canWrite ? () => setReplyTo(thread.message.id) : null}
              />
              {(thread.replies.length > 0 || replyTo === thread.message.id) && (
                <ol className="mt-3 space-y-4 border-l-2 border-current/20 pl-4">
                  {thread.replies.map((reply) => (
                    <li key={reply.id}>
                      <Message
                        slug={slug}
                        message={reply}
                        role={role}
                        onReply={null}
                      />
                    </li>
                  ))}
                  {replyTo === thread.message.id && (
                    <li>
                      <Composer
                        slug={slug}
                        parentId={thread.message.id}
                        label={t.replyTo(thread.message.authorName)}
                        autoFocus
                        onCancel={() => setReplyTo(null)}
                        onDone={() => {
                          setReplyTo(null);
                          router.refresh();
                        }}
                      />
                    </li>
                  )}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}

      {moreHref && (
        <p className="mt-4 text-center">
          <Link
            href={moreHref}
            scroll={false}
            className={plainButton + " inline-flex items-center"}
          >
            {t.loadOlder}
          </Link>
        </p>
      )}
    </div>
  );
}

function Composer({
  slug,
  parentId,
  label,
  autoFocus = false,
  onCancel,
  onDone,
}: {
  slug: string;
  parentId: string | null;
  label: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  onDone: () => void;
}) {
  const t = useT().chat;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await call(
        `/api/chat/${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: json,
          body: JSON.stringify({ body: text, parentId }),
        },
        t.failed,
      );
      setText("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-4">
      <label className="block text-sm font-bold">
        {label}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={parentId ? 2 : 3}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={t.placeholder}
          autoFocus={autoFocus}
          className="mt-1 w-full border border-current/40 bg-black/10 px-3 py-2 font-normal text-[inherit] placeholder:text-current placeholder:opacity-60"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button disabled={busy || !text.trim()} className={accentButton}>
          {busy ? t.sending : t.send}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={plainButton}>
            {t.cancel}
          </button>
        )}
        <span className="ml-auto text-xs opacity-80">
          {t.charsLeft(CHAT_MAX_LENGTH - text.length)}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold">
          {error}
        </p>
      )}
    </form>
  );
}

function Message({
  slug,
  message,
  role,
  onReply,
}: {
  slug: string;
  message: ChatMessageView;
  role: ChatRole;
  onReply: (() => void) | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useT().chat;
  const [confirm, setConfirm] = useState<"delete" | "block" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const when = new Intl.DateTimeFormat(locale === "nb" ? "nb-NO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(message.createdAt);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setConfirm(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed);
    } finally {
      setBusy(false);
    }
  }

  if (message.deleted)
    return <p className="text-sm italic opacity-70">{t.deleted}</p>;

  const base = `/api/chat/${encodeURIComponent(slug)}`;
  // The band can block fans; the author id is only sent to the band and admins.
  const canBlock = role === "owner" && message.authorId !== undefined;

  return (
    <article>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <strong>{message.authorName}</strong>
        {message.isBand && (
          <span className="px-1.5 py-0.5 text-xs font-bold [background:var(--room-accent-fill)] text-[var(--room-accent-text)]">
            {t.band}
          </span>
        )}
        {message.isMine && <span className="opacity-70">({t.you})</span>}
        {message.authorBlocked && (
          <span className="text-xs font-bold">({t.blockedBadge})</span>
        )}
        <time
          dateTime={new Date(message.createdAt).toISOString()}
          className="text-xs opacity-70"
        >
          {when}
        </time>
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">
        {message.text}
      </p>

      {confirm === null ? (
        <p className="mt-1 flex flex-wrap gap-x-4">
          {onReply && (
            <button onClick={onReply} className={linkButton}>
              {t.reply}
            </button>
          )}
          {message.canDelete && (
            <button onClick={() => setConfirm("delete")} className={linkButton}>
              {t.delete}
            </button>
          )}
          {canBlock && (
            <button
              disabled={busy}
              onClick={() =>
                message.authorBlocked
                  ? run(() =>
                      call(
                        `${base}/block`,
                        {
                          method: "POST",
                          headers: json,
                          body: JSON.stringify({
                            userId: message.authorId,
                            blocked: false,
                          }),
                        },
                        t.failed,
                      ),
                    )
                  : setConfirm("block")
              }
              className={linkButton}
            >
              {message.authorBlocked ? t.unblock : t.block}
            </button>
          )}
          {!message.isMine && (
            <Link
              href={`/rapporter?rom=${encodeURIComponent(slug)}`}
              className={linkButton}
            >
              {t.report}
            </Link>
          )}
        </p>
      ) : (
        <div role="group" className="mt-2">
          <p className="text-sm font-bold">
            {confirm === "delete"
              ? t.deleteAsk
              : t.blockAsk(message.authorName)}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  confirm === "delete"
                    ? call(
                        `${base}/${encodeURIComponent(message.id)}`,
                        { method: "DELETE" },
                        t.failed,
                      )
                    : call(
                        `${base}/block`,
                        {
                          method: "POST",
                          headers: json,
                          body: JSON.stringify({
                            userId: message.authorId,
                            blocked: true,
                          }),
                        },
                        t.failed,
                      ),
                )
              }
              className={accentButton}
            >
              {confirm === "delete" ? t.deleteYes : t.blockYes}
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirm(null)}
              className={plainButton}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm font-bold">
          {error}
        </p>
      )}
    </article>
  );
}
