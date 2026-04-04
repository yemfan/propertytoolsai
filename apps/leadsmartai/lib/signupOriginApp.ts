/**
 * Where the account first registered (shared `user_profiles.signup_origin_app`).
 * Drives post-login redirects for **consumers** on LeadSmart vs PropertyTools.
 */

export const SIGNUP_ORIGIN_APPS = ["leadsmart", "propertytools", "mobile"] as const;
export type SignupOriginApp = (typeof SIGNUP_ORIGIN_APPS)[number];

export function isAllowedSignupOriginApp(v: string): v is SignupOriginApp {
  return (SIGNUP_ORIGIN_APPS as readonly string[]).includes(v);
}

/** Consumers who should land on the PropertyTools web app after auth (not LeadSmart). */
export function consumerShouldUsePropertyToolsApp(origin: string | null | undefined): boolean {
  return origin === "propertytools";
}
