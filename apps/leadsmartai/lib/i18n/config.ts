/**
 * Shared i18n configuration for the web app — used by both the
 * client-side init (`./client.ts`) and the server-side helper
 * (`./server.ts`) so the resource map and namespace list stay in
 * one place.
 */
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@leadsmart/i18n";

import enCommon from "@leadsmart/i18n/locale/en/common";
import enSettings from "@leadsmart/i18n/locale/en/settings";
import zhCommon from "@leadsmart/i18n/locale/zh-Hans/common";
import zhSettings from "@leadsmart/i18n/locale/zh-Hans/settings";

export const I18N_COOKIE_NAME = "leadsmart_locale";

/** How long the locale cookie sticks around — one year, refreshed on each change. */
export const I18N_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const namespaces = ["common", "settings"] as const;
export type WebNamespace = (typeof namespaces)[number];

export const resources: Record<
  SupportedLocale,
  Record<WebNamespace, Record<string, unknown>>
> = {
  en: {
    common: enCommon,
    settings: enSettings,
  },
  "zh-Hans": {
    common: zhCommon,
    settings: zhSettings,
  },
};

export { DEFAULT_LOCALE, SUPPORTED_LOCALES };
export type { SupportedLocale };
