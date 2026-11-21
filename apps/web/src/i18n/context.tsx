import type { Locale } from "@lume/contracts";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { en } from "./en.js";
import { ru, type MessageKey } from "./ru.js";

const dictionaries: Record<Locale, Record<MessageKey, string>> = { ru, en };

export type TranslateParams = Record<string, string | number>;

function interpolate(value: string, params?: TranslateParams): string {
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

const I18nContext = createContext<{
  locale: Locale;
  t: (key: MessageKey, params?: TranslateParams) => string;
}>({
  locale: "ru",
  t: (key, params) => interpolate(ru[key], params),
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
      t: (key: MessageKey, params?: TranslateParams) => interpolate(dictionaries[locale][key], params),
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
