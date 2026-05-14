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
 *   - nav           Tab bar + navigation labels (mobile)
 *   - home          Mobile Home screen
 *   - quick_post    Mobile Quick Post wizard
 *   - leads             Mobile Leads list tab
 *   - lead_detail       Mobile Lead detail screen (/lead/[id])
 *   - lead_components   Embedded lead detail components
 *                        (QuickActionsRow, ReplySection, Pipeline*)
 *   - task_calendar_components
 *                       Task + Calendar + BookingLink cards and
 *                       composer modals (used on Lead detail, Tasks
 *                       tab, and Calendar tab)
 *   - reply_composer    SMS ReplyComposer, EmailReplyModal, AI draft
 *                       button, and the AI-action upgrade banner
 *   - inbox             Mobile Inbox tab (thread list)
 *   - calendar_screen   Mobile Calendar tab parent (sections, header,
 *                        ReminderCard)
 *   - showings_screen   Mobile Showings list + detail (status, reactions,
 *                        feedback form)
 *   - sphere_screen     Mobile Sphere screen (likely buyers / sellers)
 *   - mobile_misc_screens
 *                       Small standalone mobile screens:
 *                        notifications, post-history, scheduled,
 *                        recurring
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
export const NAMESPACES = [
  "common",
  "settings",
  "nav",
  "home",
  "quick_post",
  "leads",
  "lead_detail",
  "lead_components",
  "task_calendar_components",
  "reply_composer",
  "inbox",
  "calendar_screen",
  "showings_screen",
  "sphere_screen",
  "mobile_misc_screens",
] as const;
export type Namespace = (typeof NAMESPACES)[number];
