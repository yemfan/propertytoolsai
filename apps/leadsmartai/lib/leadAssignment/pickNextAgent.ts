/**
 * Pure least-recently-assigned picker for IDX lead distribution.
 *
 * The codebase already has the data we need — `contacts.created_at` per
 * `agent_id` where `source='idx_homes_for_sale'` is effectively a
 * "last-assigned-at" timestamp per agent. The service layer queries that
 * once per call and feeds the timestamps into this pure function, which
 * picks an agent and stays testable without DB mocking.
 *
 * Algorithm:
 *   1. Any agent in the eligible list with NO previous assignment wins
 *      first — keeps newly-onboarded agents from starving.
 *   2. Otherwise, pick the agent with the oldest last-assignment timestamp.
 *   3. Tie-break by agent id ascending (string compare) so output is
 *      deterministic across cold-start / cache-warm / etc.
 *
 * "Least-recently-assigned" rather than true round-robin avoids the need
 * for a shared counter (no migration). It self-balances when an agent is
 * added or removed, and naturally widens the gap when an agent is on
 * vacation (their timestamp ages, so they get picked last).
 */

export type AgentLastAssignment = {
  agentId: string;
  /** ISO timestamp of the agent's last IDX-lead assignment. Null = never assigned. */
  lastAssignedAt: string | null;
};

/**
 * Pick the next agent. Returns null if `eligibleAgentIds` is empty.
 *
 * @param eligibleAgentIds  Agents from the env allowlist (already trimmed + de-duped).
 * @param assignmentMap     Per-agent last-assignment timestamp. Agents not in
 *                          the map are treated as "never assigned" (highest priority).
 *                          Agents in the map but not in `eligibleAgentIds` are ignored.
 */
export function pickNextAgent(
  eligibleAgentIds: ReadonlyArray<string>,
  assignmentMap: ReadonlyMap<string, string>,
): string | null {
  if (eligibleAgentIds.length === 0) return null;

  // Step 1: any never-assigned agent wins. Picked deterministically by id
  // ascending so a fresh deploy always picks the same agent first.
  const neverAssigned = eligibleAgentIds.filter((id) => !assignmentMap.has(id)).sort();
  if (neverAssigned.length > 0) return neverAssigned[0];

  // Step 2: rank by oldest timestamp; tie-break by id ascending.
  const ranked = [...eligibleAgentIds]
    .map((id) => ({ id, ts: assignmentMap.get(id) ?? "" }))
    .sort((a, b) => {
      if (a.ts === b.ts) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      return a.ts < b.ts ? -1 : 1;
    });

  return ranked[0].id;
}

/**
 * Pure helper: parse the comma-separated allowlist from the env var into a
 * de-duped string array. Empty / undefined input returns [].
 */
export function parseAgentAllowlist(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Pure helper: build the `Map<agentId, lastAssignedAt>` from a database row
 * shape. Lives here so the service layer's row-mapping is unit-testable.
 */
export function buildAssignmentMap(
  rows: ReadonlyArray<AgentLastAssignment>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    if (!r.lastAssignedAt) continue; // null / "" → treat as never-assigned
    // If the same agent appears twice (shouldn't happen but defensive),
    // keep the most recent timestamp.
    const existing = out.get(r.agentId);
    if (!existing || existing < r.lastAssignedAt) {
      out.set(r.agentId, r.lastAssignedAt);
    }
  }
  return out;
}
