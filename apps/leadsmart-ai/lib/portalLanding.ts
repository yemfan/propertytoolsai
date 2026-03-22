/** @see apps/property-tools/lib/portalLanding.ts */
export function shouldLandOnPortalAfterLogin(
  role: string | null | undefined,
  hasAgentRow: boolean
): boolean {
  if (hasAgentRow) return true;
  const r = String(role ?? "")
    .toLowerCase()
    .trim();
  return r === "agent" || r === "broker" || r === "admin";
}
