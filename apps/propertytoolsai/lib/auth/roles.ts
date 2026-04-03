/**
 * Canonical RBAC roles for routing; stored in `leadsmart_users.role` (`user` in DB → consumer here).
 */
export const USER_ROLES = [
  "admin",
  "agent",
  "loan_broker",
  "support",
  "consumer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Roles with dedicated staff dashboards (middleware + `requireRolePage`). */
export const DASHBOARD_STAFF_ROLES = ["admin", "agent", "loan_broker", "support"] as const;

export type DashboardStaffRole = (typeof DASHBOARD_STAFF_ROLES)[number];

export function isUserRole(value: string | null | undefined): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function parseUserRole(value: string | null | undefined): UserRole {
  return isUserRole(value) ? value : "consumer";
}

export function isDashboardStaffRole(role: UserRole): role is DashboardStaffRole {
  return (DASHBOARD_STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * Default landing path after login / role hub (`/dashboard`) for each role.
 * Auth user id matches `user_profiles.user_id`; RBAC is `leadsmart_users.role`.
 */
export function getRoleHomePath(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin/platform-overview";
    case "agent":
      return "/agent/dashboard";
    case "loan_broker":
      return "/loan-broker/dashboard";
    case "support":
      return "/support/dashboard";
    case "consumer":
    default:
      return "/propertytools/dashboard";
  }
}

/** Roles that may access staff-only tools (extend per route). */
export const STAFF_ROLES: UserRole[] = ["admin", "support"];

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}
