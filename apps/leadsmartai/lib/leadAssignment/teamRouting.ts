/**
 * Pure helpers for team-scoped lead routing.
 *
 * The existing solo-agent picker (lib/leadAssignment/pickNextAgent.ts)
 * is round-robin within a single agent's own configured pool. This
 * module adds a parallel surface: round-robin within a TEAM'S
 * roster. Used when a team-owned IDX form / capture funnel routes
 * leads across the team rather than to a single owner.
 *
 * Design:
 *   - Team owner toggles each member's `in_round_robin` via the
 *     existing `agent_lead_routing` table (per-agent setting). No
 *     new column needed for the MVP.
 *   - This module's pure builder filters the team's roster down to
 *     members who are opted in, then defers to the existing
 *     `pickNextAgent` for the actual selection.
 *   - The async fetcher in `teamRouting.server.ts` reads
 *     team_memberships + agent_lead_routing in parallel and feeds
 *     the result into the pure builder.
 */

import { pickNextAgent } from "./pickNextAgent";

export type TeamMemberRoutingRow = {
  agentId: string;
  /** True if this team member opted into the routing pool. */
  inRoundRobin: boolean;
};

export type TeamRoutingInput = {
  /** All members of the team (from team_memberships). */
  members: ReadonlyArray<TeamMemberRoutingRow>;
  /** Per-agent last-assignment timestamp. Same shape pickNextAgent expects. */
  lastAssignedAt: ReadonlyMap<string, string>;
};

/**
 * Pick the next team member to receive a lead. Returns null when no
 * member has opted into the round-robin pool — caller decides
 * whether to drop the lead, fall back to the owner, or queue it.
 */
export function pickNextTeamMember(input: TeamRoutingInput): string | null {
  const eligible = input.members
    .filter((m) => m.inRoundRobin && m.agentId)
    .map((m) => m.agentId);
  return pickNextAgent(eligible, input.lastAssignedAt);
}

/**
 * Filter helper used by callers that want to inspect the eligible
 * pool (e.g. for logging or for "fan-out" notifications). Same logic
 * pickNextTeamMember uses internally — exposed so call sites don't
 * have to reimplement it.
 */
export function eligibleTeamMembers(
  members: ReadonlyArray<TeamMemberRoutingRow>,
): string[] {
  return members.filter((m) => m.inRoundRobin && m.agentId).map((m) => m.agentId);
}
