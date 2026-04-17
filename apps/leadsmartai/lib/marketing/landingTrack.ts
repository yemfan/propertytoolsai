/**
 * Client-side marketing events — wire to gtag, PostHog, Segment, etc.
 * Safe no-ops when analytics are not loaded or the user has not granted
 * analytics-cookie consent (see CookieConsent provider). The first-party
 * DOM event dispatch is unconditional — it stays inside the browser.
 */
import { hasConsent } from "@/components/cookie-consent/CookieConsent";

export type LandingEventName =
  | "landing_view"
  | "landing_role_change"
  | "landing_cta_click"
  | "landing_nav_click"
  | "landing_demo_click"
  | "landing_ecosystem_tools_click"
  | "landing_exit_intent_open"
  | "landing_exit_intent_dismiss"
  | "landing_exit_intent_submit"
  | "vsl_play_clicked"
  | "vsl_cta_clicked";

export function trackLandingEvent(
  event: LandingEventName,
  props?: Record<string, string | number | boolean | undefined>
) {
  if (typeof window === "undefined") return;

  const payload = { event, ...props, ts: Date.now() };

  // Third-party trackers are gated on analytics consent (GDPR / ePrivacy).
  // Without consent we skip the network call entirely — don't ship ad /
  // analytics payloads until the user opts in.
  if (hasConsent("analytics")) {
    try {
      const w = window as Window & {
        gtag?: (...args: unknown[]) => void;
        posthog?: { capture?: (e: string, p?: Record<string, unknown>) => void };
      };
      w.gtag?.("event", event, props);
      w.posthog?.capture?.(event, props as Record<string, unknown>);
    } catch {
      /* ignore */
    }
  }

  // First-party DOM event — stays inside the browser, safe without consent.
  try {
    window.dispatchEvent(new CustomEvent("leadsmart:landing", { detail: payload }));
  } catch {
    /* ignore */
  }

  if (process.env.NODE_ENV === "development") {
    console.debug(
      "[landing]",
      event,
      props,
      hasConsent("analytics") ? "" : "(3p skipped — no consent)",
    );
  }
}
