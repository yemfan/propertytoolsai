"use client";

import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@leadsmart/i18n";

import {
  I18N_COOKIE_MAX_AGE_SECONDS,
  I18N_COOKIE_NAME,
  namespaces,
  resources,
} from "./config";

let initialized = false;

/**
 * Initialize the client-side i18next instance. Called by the
 * top-level `<I18nProvider>` with the server-resolved locale so
 * the client matches what SSR rendered, avoiding hydration flicker.
 *
 * Safe to call multiple times — subsequent calls just sync the
 * language if it changed.
 */
export function initClientI18n(initialLocale: SupportedLocale): typeof i18n {
  if (!initialized) {
    void i18n.use(initReactI18next).init({
      resources: resources as unknown as Resource,
      lng: initialLocale,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: [...SUPPORTED_LOCALES],
      defaultNS: "common",
      ns: [...namespaces],
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    initialized = true;
  } else if (i18n.language !== initialLocale) {
    void i18n.changeLanguage(initialLocale);
  }
  return i18n;
}

/**
 * Persist the agent's language pick. Writes the cookie so SSR
 * picks up the choice on the next navigation, then flips the
 * client instance so the current page re-renders.
 */
export function setLocaleCookie(locale: SupportedLocale): void {
  if (typeof document === "undefined") return;
  const maxAge = I18N_COOKIE_MAX_AGE_SECONDS;
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = [
    `${I18N_COOKIE_NAME}=${locale}`,
    "path=/",
    `max-age=${maxAge}`,
    "samesite=lax",
    isHttps ? "secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  void i18n.changeLanguage(locale);
}

export { i18n };
