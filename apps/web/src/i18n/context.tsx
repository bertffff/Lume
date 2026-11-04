import type { Locale } from "@lume/contracts";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { en } from "./en.js";
import { ru, type MessageKey } from "./ru.js";

const dictionaries: Record<Locale, Record<MessageKey, string>> = { ru, en };

const I18nContext = createContext<{
  locale: Locale;
  t: (key: MessageKey) => string;
}>({
  locale: "ru",
  t: (key) => ru[key],
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      locale,
      t: (key: MessageKey) => dictionaries[locale][key],
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function detectLocale(language: string | undefined): Locale {
  if (language?.toLowerCase().startsWith("en")) {
    return "en";
  }
  return "ru";
}
