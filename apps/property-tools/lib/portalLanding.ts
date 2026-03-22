/**
 * After login, agent / broker / admin (or anyone with an `agents` row) lands on `/portal`
 * unless a `redirect` query param is present.
 */
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
