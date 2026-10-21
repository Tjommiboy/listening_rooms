import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { CreateBandForm } from "@/components/studio/CreateBandForm";
import { StatsPanel } from "@/components/studio/StatsPanel";
import { Library } from "@/components/studio/Library";
import { SubscribeButton } from "@/components/SubscribeButton";
import { StripeConnectPanel } from "@/components/studio/StripeConnectPanel";
import { bandPlanActive, getBandByOwner } from "@/lib/access";
import { isAdmin } from "@/lib/admin";
import { getBandState } from "@/lib/billing";
import { listAlbums, listBooklets } from "@/lib/albums";
import { ARTIST_PLAN_PRICE_KR } from "@/lib/pricing";
import { getT } from "@/lib/i18n/server";
import { currentMonth } from "@/lib/reports";
import { getCurrentUser, paymentProvider } from "@/lib/session";
import { refreshBandStripe } from "@/lib/stripe-sync";
import { stripeEnabled } from "@/lib/stripe";
import { QUOTA_BYTES, storageUsed } from "@/lib/storage";
import { hasConfirmedRights } from "@/lib/rights";
import { listTracks } from "@/lib/tracks";

export default async function StudioPage() {
  const [user, { studio: t }] = await Promise.all([getCurrentUser(), getT()]);
  const found = user ? await getBandByOwner(user.id) : null;
  // Back from Stripe onboarding (or still waiting): ask Stripe for the status.
  const band = found ? await refreshBandStripe(found) : null;
  const [planActive, state, tracks, used, albums, booklets] = band
    ? await Promise.all([
        bandPlanActive(band.id),
        getBandState(band.id),
        listTracks(band.id, { includeDisabled: true }),
        storageUsed(band.id),
        listAlbums(band.id),
        listBooklets(band.id),
      ])
    : [false, "trial" as const, [], { stored: 0, reserved: 0 }, [], {}];

  const rightsConfirmed = band ? await hasConfirmedRights(band.id) : false;

  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
          {t.eyebrow}
        </p>
        <h1 className="serif mt-4 text-6xl tracking-[-.08em] md:text-7xl">
          {band ? `${band.name}.` : t.titleNoBand}
        </h1>

        {!user && (
          <div className="mt-10">
            <p className="max-w-xl leading-relaxed text-moss dark:text-stone">
              {t.loginIntro}
            </p>
            <Link
              href="/logg-inn?next=/studio"
              className="mt-6 inline-block bg-[#ff5b24] px-6 py-3 font-bold text-white"
            >
              {t.loginButton}
            </Link>
          </div>
        )}

        {user && !band && <CreateBandForm />}

        {band?.disabled_at && (
          <div
            role="alert"
            className="mt-8 max-w-xl rounded-xl border-2 border-red-700 bg-red-50 p-5 text-ink dark:border-coral dark:bg-ink dark:text-cream"
          >
            <strong className="block text-lg">{t.disabledTitle}</strong>
            <p className="mt-1 text-sm leading-relaxed">{t.disabledText}</p>
          </div>
        )}

        {band && (state === "locked" || state === "closed") && (
          <div
            role="alert"
            className="mt-8 max-w-xl rounded-xl border-2 border-red-700 bg-red-50 p-5 text-ink dark:border-coral dark:bg-ink dark:text-cream"
          >
            <strong className="block text-lg">
              {state === "locked" ? t.lockedTitle : t.closedTitle}
            </strong>
            <p className="mt-1 text-sm leading-relaxed">
              {state === "locked" ? t.lockedText : t.closedText}
            </p>
          </div>
        )}

        {band && (
          <>
            <p className="mt-5 max-w-xl leading-relaxed text-moss dark:text-stone">
              {t.yourRoom}{" "}
              <Link className="font-bold underline" href={`/room/${band.slug}`}>
                /room/{band.slug}
              </Link>
              <br />
              <span className="text-sm">
                {band.bucket_name
                  ? t.bucket(band.bucket_name)
                  : t.bucketPending}
              </span>
            </p>
            <Link
              href="/studio/rom"
              className="mt-8 flex max-w-xl items-center justify-between gap-4 rounded-xl border-2 border-dashed border-pine p-5 hover:bg-sage dark:border-clay dark:hover:bg-ink"
            >
              <span>
                <strong className="block text-lg">{t.customize}</strong>
                <span className="text-sm text-moss dark:text-stone">
                  {t.customizeText}
                </span>
              </span>
              <span aria-hidden="true" className="text-3xl">
                ✎
              </span>
            </Link>
            <div className="mt-12 grid gap-6 md:grid-cols-[1fr_300px]">
              <Library
                canUpload={planActive}
                rightsConfirmed={rightsConfirmed}
                initialTracks={tracks}
                initialAlbums={albums}
                initialBooklets={booklets}
                usedBytes={used.stored}
                quotaBytes={QUOTA_BYTES}
              />
              <div className="self-start rounded-xl bg-ink p-8 text-paper">
                <p className="text-xs font-bold tracking-[.16em] text-mist">
                  {t.planEyebrow}
                </p>
                <p className="mt-5 text-4xl font-bold">
                  {ARTIST_PLAN_PRICE_KR} kr{" "}
                  <span className="text-base font-normal text-fog">
                    {t.perMonth}
                  </span>
                </p>
                <p className="mt-4 text-sm leading-relaxed text-fog">
                  {t.planText}
                </p>
                <SubscribeButton
                  plan
                  signedIn
                  hasAccess={planActive}
                  provider={user ? paymentProvider(user) : "vipps"}
                />
              </div>
            </div>
            {stripeEnabled() && (
              <StripeConnectPanel
                connected={Boolean(band.stripe_account_id)}
                ready={Boolean(band.stripe_charges_enabled)}
              />
            )}
            <StatsPanel currentMonth={currentMonth()} isAdmin={isAdmin(user)} />
          </>
        )}
      </section>
    </main>
  );
}
