/**
 * Canonical locale codes used across the LeadSmart web + mobile apps.
 *
 * We normalize on BCP-47 with the script subtag for Chinese so the
 * user's intent is unambiguous ("zh-Hans" vs "zh-Hant"). Spanish
 * lands as "es" (without a country code) for now — a region split
 * (es-MX / es-ES) can come later if the translations diverge.
 *
 * Adding a new locale: append the code here, drop matching files
 * under `packages/i18n/locales/<code>/`, and the runtime init code
 * picks it up automatically.
 */
export const SUPPORTED_LOCALES = ["en", "zh-Hans"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

/**
 * BCP-47 tags we treat as aliases of a SupportedLocale.
 *
 * Mobile's `expo-localization` returns the OS-level tag verbatim
 * (e.g. "zh-CN", "zh-TW", "zh-Hans-CN"). Web sees the same range
 * through `Accept-Language`. This map collapses the family down to
 * one of our supported codes.
 *
 * Returns null when nothing matches — caller falls back to DEFAULT_LOCALE.
 */
export function resolveLocale(input: string | null | undefined): SupportedLocale | null {
  if (!input) return null;
  const lower = input.toLowerCase();

  // Direct match (already canonical).
  for (const loc of SUPPORTED_LOCALES) {
    if (lower === loc.toLowerCase()) return loc;
  }

  // Chinese family — collapse Hans / CN / SG to zh-Hans. Hant /
  // TW / HK aren't supported yet, but when they are we'll add a
  // separate "zh-Hant" entry; for now they fall through to null
  // and the caller defaults to English.
  if (lower.startsWith("zh")) {
    if (lower.includes("hant") || lower.includes("tw") || lower.includes("hk") || lower.includes("mo")) {
      return null;
    }
    return "zh-Hans";
  }

  // English variants.
  if (lower.startsWith("en")) return "en";

  return null;
}

/**
 * Display-friendly label for a locale code. Used by the language
 * picker in Settings. Always renders in the target language (so
 * "中文" reads as "中文" even when the current locale is English),
 * which is the standard convention for language pickers.
 */
export function localeDisplayName(locale: SupportedLocale): string {
  switch (locale) {
    case "en":
      return "English";
    case "zh-Hans":
      return "简体中文";
  }
}
