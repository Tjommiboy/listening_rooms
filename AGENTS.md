# Listening Rooms – working rules

Rules for anyone (human or AI tool) working in this project. Keep it short;
add a line when we learn something the hard way. (`CLAUDE.md` just points here.)

## Where things live

- This repo: `~/Workspace/projects/listening-rooms` → GitHub `Tjommiboy/listening_rooms`, branch `main`.
  Anand commits and pushes; don't commit or push unless asked.
- Screenshots, previews and other work files: `~/Workspace/claude-outputs/listening-rooms`.
  Never put them inside this repo.
- Plans, roadmap and decisions: the "Listening Rooms" project in Claude
  (`claude/status-and-roadmap.md`, `claude/architecture-access-and-storage.md`). Check the build order there
  before starting new features.
- The old prototype in `~/Documents/Codex/2026-09-18/ca/outputs/listening-rooms` is obsolete. Don't work there.

## Stack

- Next.js pinned to `~16.3.8` (OpenNext for Cloudflare breaks on 16.4). Don't upgrade without testing `npm run preview`.
- Cloudflare Workers via `@opennextjs/cloudflare`; D1 database (`DB`); one private R2 bucket per band
  (`lib/band-buckets.ts`; locally each "bucket" is a folder in the `DEV_MEDIA` binding).
- Worker entry is `custom-worker.ts`: the OpenNext app plus a daily cron (04:00 UTC) that POSTs to
  `/api/cron/charges` with `CRON_SECRET`. It is excluded from the Next.js type check.
- Tailwind v4, TypeScript, React 19.

## Payments and login (the band is the seller)

- **Norway:** Vipps Login + Vipps Recurring (`lib/vipps.ts`, `lib/vipps-login.ts`, `lib/agreements.ts`).
  Vipps never charges by itself, so `lib/billing.ts` (`runMonthlyCharges`) creates each month's charge.
- **Outside Norway:** email login link (`lib/email-login.ts`, Resend) + Stripe (`lib/stripe.ts`, `lib/stripe-sync.ts`).
  Fan subscriptions run on the band's Connect (Express) account with our 10 % as application fee; band plan on our account.
  Plain `fetch`, no Stripe SDK; API version pinned to `2024-06-20` – keep webhooks on the same version.
- Prices: band plan 49 kr/month and 10 % fee (`lib/pricing.ts`); fan price 19 kr/band/month
  (`bands.member_price_kr`, fixed in beta). Always NOK.
- Failure rules live in `lib/billing.ts`: fan access pauses when the paid period ends; band gets 3 days' grace,
  then studio locked, room closed after 30 more days. Don't change these without checking the project plan.
- Access is decided on the server for every stream (`lib/access.ts`, `/api/stream/<trackId>`). Never hand out
  bucket URLs or keys.
- Local test switches: `ALLOW_DEMO_*` are ignored in production builds (`lib/demo.ts`); `VIPPS_FAKE` is ignored
  when `VIPPS_ENV=production`. Keep it that way.

## Rules

- **Never run `npm install` in this folder from a Linux VM or container.** It replaces the Mac's native
  binaries and breaks `node_modules`. Install only from the Mac's own Terminal.
- **Database changes are new numbered files in `migrations/`** (next: `0013_…`). Never edit an existing one.
  After adding one, tell the user to run `npm run db:migrate:local` (and `db:migrate:remote` before deploying).
- **New env vars/secrets go in `.env.example`** with a comment on where to get them; production values are
  Worker secrets (`npx wrangler secret put …`).
- **Every user-facing text goes in `lib/i18n/dictionaries.ts`** in both `nb` (source of truth) and `en`.
- **Band input is untrusted.** Themes go through `parseTheme`, links through `parseLinks`, names through
  `cleanBandName`; text is rendered as plain text, images are sniffed (JPEG/PNG/GIF/WebP only).
- **Webhooks are verified** (Vipps HMAC, Stripe signature) before anything is read from them.
- **Accessibility:** text contrast at least 4.5:1 (check both ends of every gradient), respect
  `prefers-reduced-motion`, and anything that moves on its own for more than 5 seconds must be pausable.
- **Animation:** animate only `opacity` and `transform`.
- **Before handing over:** `npx tsc --noEmit`, `npx eslint`, `npm test` and `npx next build` pass.
- **Content safety:** a band must have confirmed the upload declaration (`lib/rights.ts`, `BAND_TERMS_VERSION`) before it can
  upload; bump the version when the declaration or band terms change. Admins switch songs/bands off in `/admin/rapporter`
  (`lib/moderation.ts`, logged in `moderation_log`). Every query that serves a song, a room or an image must skip
  `tracks.disabled_at` / `bands.disabled_at` (stream, plays, media, discovery already do).
- **Billing time rules** (grace days, due dates, paid periods, fan states) live in `lib/billing-rules.ts`, with no
  imports, and are covered by `test/billing-rules.test.ts`. Change a rule there and update the test.
- **Room chat** (`lib/chat.ts`, UI `components/room/ChatBox.tsx`): only paying fans and the band write; admins can read and
  delete. Message limits and cleanup are in `lib/chat-rules.ts` (no imports, tested). Messages are plain text, soft-deleted.
- Never commit `.env*` (except `.env.example`) or anything under `.wrangler/` or `.open-next/`.
- When something new is decided or built, update the project's `claude/status-and-roadmap.md` too.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
