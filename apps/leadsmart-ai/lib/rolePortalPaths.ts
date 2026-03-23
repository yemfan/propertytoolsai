/**
 * Role → portal hub + post-login dashboard URLs (client-safe; keep in sync with `rolePortalServer.ts`).
 */
export const BROKER_PORTAL_ROLES = new Set([
  "broker",
  "broker_owner",
  "managing_broker",
  "team_lead",
  "brokerage_admin",
  "owner",
  "partner",
]);

export type PortalKind = "admin" | "broker" | "agent";

/** Primary CRM dashboard (shared shell) for agents. */
export const DASHBOARD_HOME_PATH = "/dashboard/overview";

/** Brokerage leadership dashboard (same CRM shell; brokerage-focused home). */
export const BROKER_DASHBOARD_PATH = "/dashboard/broker";

/** Support / platform ops — does not require an `agents` row. */
export const ADMIN_SUPPORT_HOME_PATH = "/admin/support";

/**
 * Where to send a signed-in professional after login / “Dashboard” in account menu.
 * (Hub pages `/agent`, `/broker`, `/admin` are link indexes only — not the main work surface.)
 */
export function resolveRoleHomePath(role: string | null | undefined, _hasAgentRow: boolean): string {
  const r = String(role ?? "").toLowerCase().trim();
  if (r === "admin" || r === "support") return ADMIN_SUPPORT_HOME_PATH;
  if (BROKER_PORTAL_ROLES.has(r)) return BROKER_DASHBOARD_PATH;
  return DASHBOARD_HOME_PATH;
}

/** Whether `role` may access the `/agent`, `/broker`, or `/admin` hub + layout tree. */
export function matchesPortalKind(role: string | null | undefined, kind: PortalKind): boolean {
  const r = String(role ?? "").toLowerCase().trim();
  if (kind === "admin") {
    return r === "admin" || r === "support";
  }
  if (kind === "broker") {
    return BROKER_PORTAL_ROLES.has(r);
  }
  // Agent portal: everyone else with CRM access (not admin/support/broker)
  if (r === "admin" || r === "support") return false;
  if (BROKER_PORTAL_ROLES.has(r)) return false;
  return true;
}

/**
 * Legacy hub path (`/agent` | `/broker` | `/admin`) for portal index pages and deep links.
 */
export function getProfessionalPortalPath(
  role: string | null | undefined,
  _hasAgentRow: boolean
): `/${PortalKind}` {
  const r = String(role ?? "").toLowerCase().trim();
  if (r === "admin" || r === "support") return "/admin";
  if (BROKER_PORTAL_ROLES.has(r)) return "/broker";
  return "/agent";
}
