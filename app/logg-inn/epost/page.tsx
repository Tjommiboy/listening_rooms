import { Navigation } from "@/components/Navigation";
import { getT } from "@/lib/i18n/server";

// Where the emailed login link lands. One button press logs in (a POST), so
// link scanners in mail programs don't use up the link.
export default async function EmailLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const t = (await getT()).login;
  return (
    <main className="min-h-screen bg-paper dark:bg-night">
      <Navigation />
      <section className="mx-auto max-w-md px-5 py-16">
        <h1 className="serif text-5xl tracking-[-.08em]">{t.title}</h1>
        <form method="post" action="/api/auth/email/callback" className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button className="w-full bg-ink py-3 font-bold text-paper dark:bg-cream dark:text-ink">
            {t.title.replace(/\.$/, "")}
          </button>
        </form>
      </section>
    </main>
  );
}
