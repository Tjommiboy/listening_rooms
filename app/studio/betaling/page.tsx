import Link from "next/link";
import { redirect } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { GetPaidWizard } from "@/components/studio/GetPaidWizard";
import { StripeConnectPanel } from "@/components/studio/StripeConnectPanel";
import { getBandByOwner } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import { getPayoutView } from "@/lib/payout";
import { getCurrentUser, paymentProvider } from "@/lib/session";
import { stripeEnabled } from "@/lib/stripe";

// Studio → "Get paid": what a band needs before fans can pay it.
// Bands signed in with Vipps (Norway) get the Vipps wizard; bands signed in
// by email (abroad) connect Stripe instead.
export default async function GetPaidPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/logg-inn?next=/studio/betaling");
  const band = await getBandByOwner(user.id);
  if (!band) redirect("/studio");
  const [view, { payout: t }] = await Promise.all([
    getPayoutView(band.id),
    getT(),
  ]);
  if (!view) redirect("/studio");
  const viaStripe = paymentProvider(user) === "stripe";

  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-4xl px-5 pb-24 pt-12">
        <Link href="/studio" className="text-sm font-bold underline">
          {t.back}
        </Link>
        <p className="mt-6 text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
          {t.eyebrow}
        </p>
        <h1 className="serif mt-3 text-5xl tracking-[-.07em]">
          {viaStripe ? t.stripeTitle : t.title}
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-moss dark:text-stone">
          {viaStripe ? t.stripeText : t.intro}
        </p>
        {viaStripe ? (
          <>
            {stripeEnabled() && (
              <StripeConnectPanel
                connected={Boolean(band.stripe_account_id)}
                ready={Boolean(band.stripe_charges_enabled)}
              />
            )}
            <p className="mt-8 max-w-xl text-sm leading-relaxed">
              {view.liveApproved
                ? t.live.done
                : band.stripe_charges_enabled
                  ? t.live.waiting
                  : t.live.todo}
            </p>
          </>
        ) : (
          <GetPaidWizard initial={view} userName={user.name} />
        )}
      </section>
    </main>
  );
}
