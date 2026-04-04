/**
 * Shared with {@link AuthModal} and `/auth/complete-profile` (OAuth onboarding).
 * Empty `value` maps to DB role `user` (consumer). Keep labels in sync anywhere this file is imported.
 */

export const SIGNUP_ROLE_OPTIONS = [
  { value: "", label: "Consumer (default)" },
  { value: "agent", label: "Real Estate Agent" },
  { value: "broker", label: "Loan Broker" },
  { value: "support", label: "System Support" },
] as const;

export function signupRoleToDbRole(value: string): string {
  return value === "" ? "user" : value;
}

export function isSignupRoleAssigned(value: string): boolean {
  return value !== "";
}
