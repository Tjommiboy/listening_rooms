# Listening Rooms

Et rom på nett der uavhengige band deler eksklusivt materiale med fansen. Norge først, betaling med Vipps.

Next.js 16, TypeScript og Tailwind v4.

## Forretningsmodell

- Band: 49 kr/mnd for 10 GB privat lagring (Cloudflare R2).
- Fans: 19 kr/mnd per band, betalt med Vipps faste betalinger (Recurring API).
- Listening Rooms tar imot alle betalinger, beholder 10 % av fanabonnementene og betaler ut resten til bandene hver måned.

## Kjør lokalt

Krever Node.js 20.9 eller nyere. Alt kjører lokalt, også database (D1) og lagring (R2) – du trenger ikke Cloudflare-konto for å utvikle.

```bash
npm install
cp .env.example .env.local      # sett ALLOW_DEMO_*=true for å teste uten Vipps
npm run db:migrate:local        # lager tabellene i lokal D1
npm run dev
```

Åpne `http://localhost:3000`, logg inn som testbruker, gå til `/studio`, lag et band og last opp lydfiler. Logg inn som en annen testbruker for å se rommet som fan.

## Hvordan lagring og tilgang henger sammen

- **Hvert band får sin egen private R2-bøtte** (`lr-band-<id>`) i Listening Rooms sin Cloudflare-konto. Bøtta opprettes automatisk via Cloudflare-API-et når bandet lager rommet sitt (og prøves på nytt ved første opplasting hvis det feilet). Band trenger aldri en Cloudflare-konto.
- Studio sender filene i biter på 10 MB til vårt eget API, som skriver dem inn i bandets bøtte via R2 sitt S3-API. Ingen nøkler eller URL-er blir delt ut, og ingen bøtter er offentlige.
- Lokalt, uten Cloudflare-nøkler, er hver «bøtte» en mappe i den lokale R2-bindingen `DEV_MEDIA`, så alt kan testes uten konto.
- **10 GB-kvote** sjekkes når en opplasting starter (lagret + pågående), og hver bit må ha nøyaktig riktig størrelse, så et band kan ikke lagre mer enn det har reservert.
- **Tilgang** styres av tabellen `agreements` i D1. Én rad per Vipps-avtale (`fan` = 19 kr for ett band, `band_plan` = 49 kr). Webhooken setter `paid_until` når et trekk er gjennomført. En fan har tilgang så lenge `paid_until` (+ 3 dagers frist) er fram i tid. En stoppet avtale gir tilgang ut måneden som er betalt.
- **All avspilling går gjennom `/api/stream/<trackId>`**, som sjekker tilgang før én eneste byte sendes, og støtter `Range` så spoling fungerer.

## Publisere til Cloudflare

```bash
npx wrangler login
npx wrangler d1 create listening-rooms           # lim inn database_id i wrangler.jsonc
npx wrangler r2 bucket create listening-rooms-dev-media   # tom, kreves bare av bindingen
npm run db:migrate:remote
npx wrangler secret put R2_ACCOUNT_ID            # Cloudflare-kontoens ID
npx wrangler secret put CLOUDFLARE_API_TOKEN     # API-token med «Workers R2 Storage: Edit» (oppretter bøtter)
npx wrangler secret put R2_ACCESS_KEY_ID         # R2 API-token, «Object Read & Write», alle bøtter
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put VIPPS_CLIENT_SECRET      # og de andre Vipps-nøklene
npm run deploy
```

Merk om pris: R2 sitt gratisnivå (10 GB lagring per måned) gjelder for hele Cloudflare-kontoen, ikke per bøtte. Over det koster lagring 0,015 USD per GB-måned (ca. 1,6 kr for et fullt 10 GB-band). Nedlasting/strømming er gratis.

Registrer webhooken (`<APP_URL>/api/vipps/webhook`) i Vipps Webhooks API for hendelsene `recurring.charge-captured.v1`, `recurring.charge-failed.v1`, `recurring.agreement-activated.v1`, `recurring.agreement-stopped.v1`, `recurring.agreement-expired.v1` og `recurring.agreement-rejected.v1`.

Merk: `next` er låst til 16.3.x fordi `@opennextjs/cloudflare` ennå ikke støtter Next 16.4.

## Sider

- `/` — forside
- `/artists` — priser og informasjon for band
- `/room/<slug>` — et lytterom (`/room/fjorden-baby` er demorommet fra migrasjonen)
- `/studio` — lag bandets rom, bestill bandplan og last opp
- `/logg-inn` — innlogging med Vipps (og testinnlogging lokalt)
- `/vilkar` — vilkår for medlemskap (lenkes fra Vipps-avtalen)

## API

- `GET /api/auth/vipps/start`, `GET /api/auth/vipps/callback` — Vipps Login
- `POST /api/vipps/agreement` — starter en månedlig avtale (`{ slug }` for fan, `{ plan: "band" }` for bandplan)
- `GET /api/vipps/status` — synker avtalen når brukeren kommer tilbake fra Vipps
- `POST /api/vipps/webhook` — mottar Recurring-hendelser, verifisert med HMAC
- `GET /api/stream/<trackId>` — beskyttet strømming
- `POST /api/studio/band`, `POST /api/studio/uploads`, `PUT …/parts/<n>`, `POST …/complete`, `DELETE /api/studio/tracks/<id>` — studio

## Gjenstår før lansering

- Daglig jobb som oppretter neste måneds trekk (`createCharge`) for aktive avtaler.
- Utbetalinger til band (90 % av fanabonnementene).
- «Si opp»-knapp for fans (`stopAgreement` finnes i `lib/vipps.ts`).
