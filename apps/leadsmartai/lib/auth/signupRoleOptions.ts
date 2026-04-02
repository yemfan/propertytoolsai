/** Shared with {@link AuthModal} and `/auth/complete-profile` (OAuth onboarding). */

export const SIGNUP_ROLE_OPTIONS = [
  { value: "", label: "Not Assigned" },
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
