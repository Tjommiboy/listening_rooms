# Listening Rooms – working rules

Rules for anyone (human or AI tool) working in this project. Keep it short;
add a line when we learn something the hard way.

## Where things live

- This repo: `~/Workspace/projects/listening-rooms` → GitHub `Tjommiboy/listening_rooms`, branch `main`.
- Screenshots, previews and other work files: `~/Workspace/claude-outputs/listening-rooms`.
  Never put them inside this repo.
- Plans, roadmap and decisions: the "Listening Rooms" project in Claude
  (`claude/status-and-roadmap.md`, `claude/architecture-access-and-storage.md`).

## Stack

- Next.js pinned to `~16.3.8` (OpenNext for Cloudflare breaks on 16.4). Don't upgrade without testing `npm run preview`.
- Cloudflare Workers via `@opennextjs/cloudflare`; D1 database (`DB`); one private R2 bucket per band.
- Tailwind v4, TypeScript, React 19.

## Rules

- **Never run `npm install` in this folder from a Linux VM or container.** It replaces the Mac's native
  binaries and breaks `node_modules`. Install only from the Mac's own Terminal.
- **Database changes are new numbered files in `migrations/`** (next: `0008_…`). Never edit an existing one.
  After adding one, tell the user to run `npm run db:migrate:local` (and `db:migrate:remote` before deploying).
- **Every user-facing text goes in `lib/i18n/dictionaries.ts`** in both `nb` (source of truth) and `en`.
- **Band input is untrusted.** Themes go through `parseTheme`, links through `parseLinks`, names through
  `cleanBandName`; text is rendered as plain text, images are sniffed (JPEG/PNG/GIF/WebP only).
- **Accessibility:** text contrast at least 4.5:1 (check both ends of every gradient), respect
  `prefers-reduced-motion`, and anything that moves on its own for more than 5 seconds must be pausable.
- **Animation:** animate only `opacity` and `transform`.
- **Before handing over:** `npx tsc --noEmit`, `npx eslint`, and `npx next build` pass.
- Never commit `.env*` (except `.env.example`) or anything under `.wrangler/`.
