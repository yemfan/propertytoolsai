/**
 * Canonical values for `public.user_profiles.role` (shared Supabase project).
 *
 * **Access control:** Enforce in server Route Handlers, Server Actions, and RLS policies.
 * UI may show this role for clarity; never rely on client-side role alone for authorization.
 *
 * **Changes:** End users should not self-assign privileged roles. Use admin tools or
 * controlled signup flows (e.g. agent onboarding) to set `role`.
 */

/** Values stored in `user_profiles.role` — keep migrations and dashboards aligned. */
export const USER_PROFILE_ROLES = [
  "user",
  "agent",
  "loan_broker",
  "broker",
  "broker_owner",
  "managing_broker",
  "team_lead",
  "brokerage_admin",
  "owner",
  "partner",
  "admin",
  "support",
] as const;

export type UserProfileRole = (typeof USER_PROFILE_ROLES)[number];

/** Roles that identify real-estate or platform professionals (not plain consumers). */
export const PROFESSIONAL_PROFILE_ROLES = new Set<string>([
  "agent",
  "loan_broker",
  "broker",
  "broker_owner",
  "managing_broker",
  "team_lead",
  "brokerage_admin",
  "owner",
  "partner",
  "admin",
  "support",
]);

export function isProfessionalProfileRole(role: string | null | undefined): boolean {
  const r = String(role ?? "")
    .toLowerCase()
    .trim();
  return r !== "" && PROFESSIONAL_PROFILE_ROLES.has(r);
}

const ROLE_LABELS: Record<string, string> = {
  user: "Consumer",
  agent: "Real estate agent",
  loan_broker: "Loan / mortgage broker",
  broker: "Broker",
  broker_owner: "Broker owner",
  managing_broker: "Managing broker",
  team_lead: "Team lead",
  brokerage_admin: "Brokerage admin",
  owner: "Owner",
  partner: "Partner",
  admin: "Administrator",
  support: "Support",
};

/** Human-readable label for profile and account UI. */
export function formatUserRoleLabel(role: string | null | undefined): string {
  const r = String(role ?? "user")
    .toLowerCase()
    .trim();
  if (ROLE_LABELS[r]) return ROLE_LABELS[r];
  return r
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** One-line description for “My profile” and tooltips. */
export function describeUserRole(role: string | null | undefined): string {
  const r = String(role ?? "user")
    .toLowerCase()
    .trim();
  switch (r) {
    case "user":
      return "Standard account for property tools and buyer/seller experiences.";
    case "agent":
      return "Access to LeadSmart CRM, leads, pipeline, and agent workflows.";
    case "loan_broker":
      return "Mortgage / loan workflows and professional tooling.";
    case "admin":
    case "support":
      return "Platform operations and support tools.";
    default:
      if (PROFESSIONAL_PROFILE_ROLES.has(r) && r !== "admin" && r !== "support") {
        return "Brokerage or team leadership access where enabled.";
      }
      return "Account access is based on this role and your subscription.";
  }
}
