import type { Metadata } from "next";
import { I18nProvider } from "@/components/I18nProvider";
import { getLocale, getT } from "@/lib/i18n/server";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: "Listening Rooms", description: t.meta.description };
}

// Runs before first paint so the page never flashes the wrong theme. A saved
// choice wins; otherwise follow the system setting, including live changes.
const themeScript = `(function () {
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function saved() {
    try { return localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch (e) { return null; }
  }
  function apply() {
    var theme = saved();
    document.documentElement.classList.toggle("dark", theme ? theme === "dark" : media.matches);
  }
  apply();
  media.addEventListener("change", apply);
})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
