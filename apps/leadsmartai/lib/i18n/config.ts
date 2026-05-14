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
import enWebContacts from "@leadsmart/i18n/locale/en/web_contacts";
import enWebGenerateLeads from "@leadsmart/i18n/locale/en/web_generate_leads";
import enWebMarketing from "@leadsmart/i18n/locale/en/web_marketing";
import enWebPosts from "@leadsmart/i18n/locale/en/web_posts";
import zhCommon from "@leadsmart/i18n/locale/zh-Hans/common";
import zhSettings from "@leadsmart/i18n/locale/zh-Hans/settings";
import zhWebContacts from "@leadsmart/i18n/locale/zh-Hans/web_contacts";
import zhWebGenerateLeads from "@leadsmart/i18n/locale/zh-Hans/web_generate_leads";
import zhWebMarketing from "@leadsmart/i18n/locale/zh-Hans/web_marketing";
import zhWebPosts from "@leadsmart/i18n/locale/zh-Hans/web_posts";

export const I18N_COOKIE_NAME = "leadsmart_locale";

/** How long the locale cookie sticks around — one year, refreshed on each change. */
export const I18N_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const namespaces = [
  "common",
  "settings",
  "web_posts",
  "web_generate_leads",
  "web_contacts",
  "web_marketing",
] as const;
export type WebNamespace = (typeof namespaces)[number];

export const resources: Record<
  SupportedLocale,
  Record<WebNamespace, Record<string, unknown>>
> = {
  en: {
    common: enCommon,
    settings: enSettings,
    web_posts: enWebPosts,
    web_generate_leads: enWebGenerateLeads,
    web_contacts: enWebContacts,
    web_marketing: enWebMarketing,
  },
  "zh-Hans": {
    common: zhCommon,
    settings: zhSettings,
    web_posts: zhWebPosts,
    web_generate_leads: zhWebGenerateLeads,
    web_contacts: zhWebContacts,
    web_marketing: zhWebMarketing,
  },
};

export { DEFAULT_LOCALE, SUPPORTED_LOCALES };
export type { SupportedLocale };
