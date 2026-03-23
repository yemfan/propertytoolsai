/**
 * Canonical RBAC roles stored in `public.profiles.role` (see Supabase migrations).
 */
export const USER_ROLES = [
  "admin",
  "agent",
  "loan_broker",
  "support",
  "consumer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string | null | undefined): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function parseUserRole(value: string | null | undefined): UserRole {
  return isUserRole(value) ? value : "consumer";
}

/** Roles that may access staff-only tools (extend per route). */
export const STAFF_ROLES: UserRole[] = ["admin", "support"];

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}
