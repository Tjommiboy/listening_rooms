import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  dictionaries,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/lib/i18n/dictionaries";

/**
 * The visitor's language: their saved choice (cookie) if any, otherwise the
 * browser's preferred language, otherwise Norwegian.
 */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (/^(nb|nn|no)\b/.test(tag)) return "nb";
    if (/^en\b/.test(tag)) return "en";
  }
  return DEFAULT_LOCALE;
}

/** Dictionary for the current request (pages, layouts and route handlers). */
export async function getT() {
  return dictionaries[await getLocale()];
}
