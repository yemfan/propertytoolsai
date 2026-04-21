/**
 * Locale resolvers — the one and only way the rest of the app picks a
 * language to use for a given action. Every AI-message call site, every
 * server component, every template lookup goes through one of these.
 *
 * Two independent resolvers:
 *   - `resolveLeadOutboundLocale` — what language to SEND to a lead in.
 *     Fallback chain: lead preference → agent default → app default (en).
 *
 *   - `resolveUiLocale` — what language to RENDER the dashboard in.
 *     Separate because a bilingual agent can run the dashboard in English
 *     while still emailing Chinese-preferred leads in Chinese (or vice
 *     versa). They happen to default to the same value for most users,
 *     but the schema keeps them independent for flexibility.
 *
 * Both resolvers never throw; they always return a `LocaleId` that's
 * guaranteed present in `LOCALE_REGISTRY`.
 */

import {
  coerceLocale,
  DEFAULT_LOCALE,
  getLocale,
  isSupportedLocale,
  type LocaleId,
} from "./registry";

export type LeadLocaleInputs = {
  /** `leads.preferred_language` — highest priority when set. */
  leadPreferredLanguage?: string | null;
  /** `user_profiles.default_outbound_language` for the owning agent. */
  agentDefaultOutboundLanguage?: string | null;
};

export type UiLocaleInputs = {
  /** `user_profiles.ui_language` for the signed-in user. */
  userUiLanguage?: string | null;
};

/**
 * Resolve the outbound locale for messages SENT to a specific lead.
 *
 * - If `leadPreferredLanguage` is a known locale with outbound enabled, use it.
 * - Else if the agent has a `default_outbound_language` set, use that.
 * - Else fall back to `en`.
 *
 * Locales without `outbound.enabled` (future: UI-ready but not outbound-
 * ready) fall through to the next tier so we never send the AI to a
 * language we haven't validated the prompt + templates for.
 */
export function resolveLeadOutboundLocale(inputs: LeadLocaleInputs): LocaleId {
  // Explicit per-lead preference wins — including 'en' when the lead
  // has specifically set English (e.g. a lead in Miami whose agent
  // defaults all outbound to zh).
  if (isSupportedLocale(inputs.leadPreferredLanguage)) {
    if (getLocale(inputs.leadPreferredLanguage).outbound.enabled) {
      return inputs.leadPreferredLanguage;
    }
  }
  // Agent default fallback. We still run through `isSupportedLocale`
  // rather than blindly coercing so an unknown value (e.g. the legacy
  // `agent_ai_settings.default_language = 'auto'` case) falls through
  // to the canonical default instead of silently mapping to 'en' via
  // coercion — the effect is the same ('en'), but explicit here.
  if (isSupportedLocale(inputs.agentDefaultOutboundLanguage)) {
    if (getLocale(inputs.agentDefaultOutboundLanguage).outbound.enabled) {
      return inputs.agentDefaultOutboundLanguage;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Resolve the UI locale for the signed-in user. The dashboard is rendered
 * in this language end-to-end (no mid-screen mixing — see product constraint
 * documented in `registry.ts`).
 *
 * Locales without `ui.enabled` fall through to EN. That's the reason Chinese
 * UI doesn't start shipping until message-catalog coverage is 100% and ZH's
 * `ui.enabled` flag is flipped.
 */
export function resolveUiLocale(inputs: UiLocaleInputs): LocaleId {
  const id = coerceLocale(inputs.userUiLanguage);
  if (getLocale(id).ui.enabled) return id;
  return DEFAULT_LOCALE;
}
