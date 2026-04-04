/**
 * Where the account first registered (shared `user_profiles.signup_origin_app`).
 */

export const SIGNUP_ORIGIN_APPS = ["leadsmart", "propertytools", "mobile"] as const;
export type SignupOriginApp = (typeof SIGNUP_ORIGIN_APPS)[number];

export function isAllowedSignupOriginApp(v: string): v is SignupOriginApp {
  return (SIGNUP_ORIGIN_APPS as readonly string[]).includes(v);
}
