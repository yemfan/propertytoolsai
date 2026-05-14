/**
 * Shared i18n contract — locale codes + resolution helpers used by
 * both `apps/leadsmartai` (web) and `apps/leadsmart-mobile` (Expo).
 *
 * Translation strings themselves live as JSON files under
 * `packages/i18n/locales/<code>/<namespace>.json`. Each app's i18next
 * init module imports those JSONs directly:
 *
 *   import enCommon from "@leadsmart/i18n/locale/en/common";
 *   import zhCommon from "@leadsmart/i18n/locale/zh-Hans/common";
 *
 * Namespaces (current set):
 *   - common        Shared verbs / status / errors used everywhere
 *   - settings      Settings screens (mobile + web)
 *
 * Future namespaces follow the same pattern — add a JSON file pair
 * (en + zh-Hans) and reference it from the app's resources map.
 */
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  resolveLocale,
  localeDisplayName,
  type SupportedLocale,
} from "./locales";

/**
 * Canonical namespace identifiers. Keep in sync with the JSON files
 * under locales/<code>/. Adding a new namespace: add the literal
 * here + the JSON file pair, and i18next will pick it up when the
 * app reinitializes.
 */
export const NAMESPACES = ["common", "settings"] as const;
export type Namespace = (typeof NAMESPACES)[number];
