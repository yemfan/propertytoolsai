import type { UserRole } from "./roles";

/**
 * Map `leadsmart_users.role` strings (and legacy aliases) to canonical `UserRole`.
 */
export function mapLegacyUserProfileRoleToRbac(legacy: string | null | undefined): UserRole {
  const r = String(legacy ?? "")
    .toLowerCase()
    .trim();
  switch (r) {
    case "admin":
      return "admin";
    case "support":
      return "support";
    case "loan_broker":
    case "lender":
    case "mortgage_broker":
      return "loan_broker";
    case "agent":
    case "broker":
    case "broker_owner":
    case "managing_broker":
    case "team_lead":
    case "brokerage_admin":
    case "owner":
    case "partner":
      return "agent";
    case "consumer":
    case "user":
    case "":
    default:
      return "consumer";
  }
}
