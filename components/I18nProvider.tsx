"use client";

import { createContext, useContext } from "react";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

const LocaleContext = createContext<Locale>("nb");

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** Dictionary for the current language, for client components. */
export function useT() {
  return dictionaries[useLocale()];
}
