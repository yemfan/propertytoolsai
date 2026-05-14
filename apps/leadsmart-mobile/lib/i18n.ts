/**
 * Mobile i18next initialization.
 *
 * Resolution order on app startup:
 *   1. User-chosen locale from AsyncStorage (set by the Language
 *      picker in Settings)
 *   2. Device locale from expo-localization (`zh-CN` → `zh-Hans`,
 *      `en-US` → `en`, etc.)
 *   3. DEFAULT_LOCALE (English)
 *
 * Translation resources are bundled — we import the JSONs directly
 * from `@leadsmart/i18n` instead of loading them over the network.
 * For an offline-first app this is the right tradeoff; the bundle
 * size cost of every supported locale is small (kilobytes per
 * namespace) compared to startup latency.
 *
 * Call `initI18n()` once from the root layout; `useTranslation()`
 * from `react-i18next` works everywhere after that.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LOCALE,
  resolveLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@leadsmart/i18n";

import enCommon from "@leadsmart/i18n/locale/en/common";
import enSettings from "@leadsmart/i18n/locale/en/settings";
import zhCommon from "@leadsmart/i18n/locale/zh-Hans/common";
import zhSettings from "@leadsmart/i18n/locale/zh-Hans/settings";

const STORAGE_KEY = "i18n:locale";

const resources = {
  en: {
    common: enCommon,
    settings: enSettings,
  },
  "zh-Hans": {
    common: zhCommon,
    settings: zhSettings,
  },
} as const;

/**
 * Read the persisted locale choice. Returns null when the user
 * hasn't picked one yet (first launch path).
 */
export async function getStoredLocale(): Promise<SupportedLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return resolveLocale(raw);
  } catch {
    return null;
  }
}

/**
 * Persist the user's language choice and switch i18next in-place
 * so all mounted components re-render in the new locale.
 */
export async function setStoredLocale(locale: SupportedLocale): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, locale);
  await i18n.changeLanguage(locale);
}

/**
 * Best-effort device locale → SupportedLocale. expo-localization
 * returns an array of locales the user prefers (in order); we walk
 * it and pick the first one we recognize.
 */
function detectDeviceLocale(): SupportedLocale | null {
  try {
    const locales = Localization.getLocales();
    for (const loc of locales) {
      const tag = loc.languageTag ?? loc.languageCode;
      const resolved = resolveLocale(tag);
      if (resolved) return resolved;
    }
  } catch {
    // expo-localization can throw on rare devices; fall through.
  }
  return null;
}

let initPromise: Promise<typeof i18n> | null = null;

/**
 * Initialize i18next once per app session. Safe to call multiple
 * times — subsequent calls return the same promise.
 */
export function initI18n(): Promise<typeof i18n> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const stored = await getStoredLocale();
    const fallback = detectDeviceLocale();
    const initial: SupportedLocale = stored ?? fallback ?? DEFAULT_LOCALE;

    await i18n.use(initReactI18next).init({
      resources,
      lng: initial,
      fallbackLng: DEFAULT_LOCALE,
      // Whitelist supported locales so an unknown stored value
      // doesn't bypass the resolver.
      supportedLngs: [...SUPPORTED_LOCALES],
      defaultNS: "common",
      ns: ["common", "settings"],
      interpolation: {
        // React Native handles escaping; double-escaping breaks
        // strings with apostrophes / quotes inside translations.
        escapeValue: false,
      },
      react: {
        // Suspense isn't worth the wiring on mobile — resources are
        // bundled, so the synchronous init above means `t()` returns
        // strings immediately on first render.
        useSuspense: false,
      },
    });
    return i18n;
  })();
  return initPromise;
}

export { i18n };
