/**
 * Team-aware agent scope. Resolves "which agent ids should this
 * dashboard query touch?" from the calling agent's identity.
 *
 * - Solo agents (no team ownership) get `scope='agent'` and a single
 *   id. Behaviour identical to the pre-teams world.
 * - Team owners get `scope='team'` and the union of every member's
 *   id across every team they own. Self is always included.
 *
 * The pure builder lives here without `server-only` so vitest can
 * hit it. The async fetcher in `scope.server.ts` calls Supabase and
 * delegates to the builder.
 */

export type AgentScope = {
  /** The calling agent. Always present in `agentIds`. */
  selfAgentId: string;
  /** Every agent id the caller is authorized to read data for. */
  agentIds: string[];
  /** 'agent' = solo / member only; 'team' = owns at least one team. */
  scope: "agent" | "team";
  /** Teams the calling agent owns. Empty when scope='agent'. */
  ownedTeamIds: string[];
  /** Convenience: ownedTeamIds[0] or null. UIs render the team name from this. */
  primaryTeamId: string | null;
};

export type AgentScopeInput = {
  selfAgentId: string;
  /** Teams this agent has role='owner' in. */
  ownedTeamIds: string[];
  /** All agent ids that appear in `team_memberships` for those teams.
   *  Self may or may not be included — the builder dedupes. */
  rosterAgentIds: string[];
};

export function buildAgentScope(input: AgentScopeInput): AgentScope {
  const dedup = new Set<string>();
  if (input.selfAgentId) dedup.add(input.selfAgentId);
  for (const id of input.rosterAgentIds) {
    if (id) dedup.add(id);
  }
  const ownsTeams = input.ownedTeamIds.length > 0;
  return {
    selfAgentId: input.selfAgentId,
    agentIds: Array.from(dedup),
    scope: ownsTeams ? "team" : "agent",
    ownedTeamIds: [...input.ownedTeamIds],
    primaryTeamId: input.ownedTeamIds[0] ?? null,
  };
}

/** Single-agent fallback used when scope resolution can't run (no
 *  agentId yet, DB unavailable, etc.). Keeps callers from special-
 *  casing failure paths. */
export function soloScope(selfAgentId: string): AgentScope {
  return {
    selfAgentId,
    agentIds: [selfAgentId],
    scope: "agent",
    ownedTeamIds: [],
    primaryTeamId: null,
  };
}
