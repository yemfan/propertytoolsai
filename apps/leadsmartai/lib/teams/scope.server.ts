import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  type AgentScope,
  buildAgentScope,
  soloScope,
} from "./scope";

/**
 * Resolve the team-aware agent scope for the calling agent.
 *
 * Two queries:
 *   1. team_memberships rows where agent_id=self AND role='owner'
 *      → list of owned team ids
 *   2. team_memberships rows where team_id IN (...) → roster
 *
 * Anything that fails returns the solo scope fallback. The caller
 * then uses `scope.agentIds` in `.in("agent_id", ids)` filters
 * instead of the old single-agent `.eq("agent_id", id)`.
 */
export async function getAgentScopeForAgent(agentId: string): Promise<AgentScope> {
  if (!agentId) return soloScope(agentId);

  try {
    const { data: ownedRows, error: ownedErr } = await supabaseAdmin
      .from("team_memberships")
      .select("team_id")
      .eq("agent_id", agentId)
      .eq("role", "owner");

    // Pre-teams installs (table not yet migrated) — fall back silently.
    if (ownedErr && isMissingRelation(ownedErr)) return soloScope(agentId);
    if (ownedErr) {
      console.warn("[teams.scope] owned-team lookup failed:", ownedErr);
      return soloScope(agentId);
    }

    const ownedTeamIds = (ownedRows ?? [])
      .map((r) => String((r as { team_id: string }).team_id))
      .filter((s) => s.length > 0);

    if (ownedTeamIds.length === 0) return soloScope(agentId);

    const { data: rosterRows, error: rosterErr } = await supabaseAdmin
      .from("team_memberships")
      .select("agent_id")
      .in("team_id", ownedTeamIds);

    if (rosterErr) {
      console.warn("[teams.scope] roster lookup failed:", rosterErr);
      return soloScope(agentId);
    }

    const rosterAgentIds = (rosterRows ?? [])
      .map((r) => String((r as { agent_id: string }).agent_id))
      .filter((s) => s.length > 0);

    return buildAgentScope({
      selfAgentId: agentId,
      ownedTeamIds,
      rosterAgentIds,
    });
  } catch (e) {
    console.warn("[teams.scope] unexpected error:", e);
    return soloScope(agentId);
  }
}

function isMissingRelation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  // 42P01: undefined_table — pre-migration installs.
  return code === "42P01";
}
