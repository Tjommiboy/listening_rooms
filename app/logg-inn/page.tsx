import { redirect } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { devLoginEnabled } from "@/lib/demo";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "@/lib/redirect";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; feil?: string }>;
}) {
  const { next: rawNext, feil } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);
  const t = (await getT()).login;

  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-md px-5 py-16">
        <h1 className="serif text-5xl tracking-[-.08em]">{t.title}</h1>
        <p className="mt-4 leading-relaxed text-moss dark:text-stone">
          {t.intro}
        </p>
        {feil === "vipps" && (
          <p role="alert" className="mt-6 text-sm text-red-700 dark:text-coral">
            {t.vippsFailed}
          </p>
        )}
        <a
          href={`/api/auth/vipps/start?next=${encodeURIComponent(next)}`}
          className="mt-8 block w-full bg-[#ff5b24] py-3 text-center font-bold text-white"
        >
          {t.withVipps}
        </a>
        {devLoginEnabled() && (
          <form
            method="post"
            action="/api/auth/dev"
            className="mt-10 rounded-xl border border-dashed border-sand p-6 dark:border-slate/40"
          >
            <p className="text-xs font-bold tracking-[.16em] text-pine dark:text-clay">
              {t.devEyebrow}
            </p>
            <input type="hidden" name="next" value={next} />
            <label className="mt-4 block text-sm font-bold" htmlFor="name">
              {t.devName}
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={60}
              className="mt-2 w-full rounded border border-sand bg-white px-3 py-2 text-ink dark:border-slate/40"
            />
            <button className="mt-4 w-full bg-ink py-3 font-bold text-paper dark:bg-cream dark:text-ink">
              {t.devSubmit}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
