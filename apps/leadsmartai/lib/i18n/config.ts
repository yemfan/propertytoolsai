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
import enWebContactsClient from "@leadsmart/i18n/locale/en/web_contacts_client";
import enWebGenerateLeads from "@leadsmart/i18n/locale/en/web_generate_leads";
import enWebAbout from "@leadsmart/i18n/locale/en/web_about";
import enWebGenerateLeadsClients from "@leadsmart/i18n/locale/en/web_generate_leads_clients";
import enWebLanding from "@leadsmart/i18n/locale/en/web_landing";
import enWebMarketing from "@leadsmart/i18n/locale/en/web_marketing";
import enWebPosts from "@leadsmart/i18n/locale/en/web_posts";
import enWebPricing from "@leadsmart/i18n/locale/en/web_pricing";
import enWebQuickPost from "@leadsmart/i18n/locale/en/web_quick_post";
import zhCommon from "@leadsmart/i18n/locale/zh-Hans/common";
import zhSettings from "@leadsmart/i18n/locale/zh-Hans/settings";
import zhWebAbout from "@leadsmart/i18n/locale/zh-Hans/web_about";
import zhWebContacts from "@leadsmart/i18n/locale/zh-Hans/web_contacts";
import zhWebContactsClient from "@leadsmart/i18n/locale/zh-Hans/web_contacts_client";
import zhWebGenerateLeads from "@leadsmart/i18n/locale/zh-Hans/web_generate_leads";
import zhWebGenerateLeadsClients from "@leadsmart/i18n/locale/zh-Hans/web_generate_leads_clients";
import zhWebLanding from "@leadsmart/i18n/locale/zh-Hans/web_landing";
import zhWebMarketing from "@leadsmart/i18n/locale/zh-Hans/web_marketing";
import zhWebPosts from "@leadsmart/i18n/locale/zh-Hans/web_posts";
import zhWebPricing from "@leadsmart/i18n/locale/zh-Hans/web_pricing";
import zhWebQuickPost from "@leadsmart/i18n/locale/zh-Hans/web_quick_post";

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
  "web_contacts_client",
  "web_generate_leads_clients",
  "web_landing",
  "web_about",
  "web_pricing",
  "web_quick_post",
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
    web_contacts_client: enWebContactsClient,
    web_generate_leads_clients: enWebGenerateLeadsClients,
    web_landing: enWebLanding,
    web_about: enWebAbout,
    web_pricing: enWebPricing,
    web_quick_post: enWebQuickPost,
  },
  "zh-Hans": {
    common: zhCommon,
    settings: zhSettings,
    web_posts: zhWebPosts,
    web_generate_leads: zhWebGenerateLeads,
    web_contacts: zhWebContacts,
    web_marketing: zhWebMarketing,
    web_contacts_client: zhWebContactsClient,
    web_generate_leads_clients: zhWebGenerateLeadsClients,
    web_landing: zhWebLanding,
    web_about: zhWebAbout,
    web_pricing: zhWebPricing,
    web_quick_post: zhWebQuickPost,
  },
};

export { DEFAULT_LOCALE, SUPPORTED_LOCALES };
export type { SupportedLocale };
