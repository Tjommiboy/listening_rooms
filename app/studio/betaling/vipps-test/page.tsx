import { notFound, redirect } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { getBandByOwner } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";
import { vippsFake } from "@/lib/vipps";

// Local testing only (VIPPS_FAKE=true): stands in for the Vipps business
// portal, where the band would check and sign its prefilled application.
export default async function VippsTestPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  if (!vippsFake()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/logg-inn?next=/studio/betaling");
  const band = await getBandByOwner(user.id);
  if (!band) redirect("/studio");
  const [{ order }, { payout: t }] = await Promise.all([searchParams, getT()]);
  if (!order) redirect("/studio/betaling");

  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-xl px-5 pb-24 pt-12">
        <h1 className="serif text-5xl tracking-[-.07em]">{t.test.title}</h1>
        <p className="mt-4 leading-relaxed text-moss dark:text-stone">
          {t.test.text}
        </p>
        <form
          method="post"
          action="/api/studio/payout/fake-vipps"
          className="mt-8 flex flex-wrap gap-3"
        >
          <input type="hidden" name="order" value={order} />
          <button
            name="result"
            value="approve"
            className="min-h-11 bg-[#ff5b24] px-5 font-bold text-white"
          >
            {t.test.approve}
          </button>
          <button
            name="result"
            value="reject"
            className="min-h-11 border border-current px-5 font-bold"
          >
            {t.test.reject}
          </button>
        </form>
      </section>
    </main>
  );
}
