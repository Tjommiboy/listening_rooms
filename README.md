# Listening Rooms

A Next.js, TypeScript, and Tailwind v4 frontend for a direct-to-fan music membership platform.

## Run locally

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Routes

- `/` — public Listening Rooms landing page
- `/artists` — artist pricing and onboarding page
- `/room/fjorden-baby` — sample artist Listening Room (rooms are defined in `lib/rooms.ts`)
- `/studio` — creator studio UI with local file selection

## Before going live

The project now includes a local-development Stripe Connect hosted-onboarding route. Add a Stripe **test** secret key to `.env.local`, set `ALLOW_DEMO_CONNECT=true`, and run the app. The Creator Studio will create a Norwegian Express connected account and redirect to Stripe’s test onboarding form.

Do not deploy that route as-is: it deliberately blocks production. A production backend needs authentication, a database that maps each authenticated artist to their `stripeAccountId`, Cloudflare R2 private storage and signed URLs, Stripe Checkout subscriptions, and webhooks that grant or revoke member access.

Copy `.env.example` to `.env.local` only when those services are added.
