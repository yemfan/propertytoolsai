/**
 * Role → first-run “portal” URL (client-safe; keep in sync with `rolePortalServer.ts` context).
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

export function getProfessionalPortalPath(
  role: string | null | undefined,
  _hasAgentRow: boolean
): `/${PortalKind}` {
  const r = String(role ?? "").toLowerCase().trim();
  if (r === "admin") return "/admin";
  if (BROKER_PORTAL_ROLES.has(r)) return "/broker";
  return "/agent";
}
