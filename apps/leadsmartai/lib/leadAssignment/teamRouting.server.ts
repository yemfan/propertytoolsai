import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabaseServer";
import { IDX_LEAD_SOURCE } from "./service";
import {
  pickNextTeamMember,
  type TeamMemberRoutingRow,
} from "./teamRouting";

/**
 * Server-side team-scoped lead assignment.
 *
 * Resolves the team's roster, joins each member's
 * `agent_lead_routing.in_round_robin` flag, fetches the per-agent
 * last-assignment timestamps, and picks. Returns the chosen
 * `agent_id` or null when nobody on the team is in the pool.
 *
 * Failure mode: any DB failure returns null. Callers fall back to
 * the team owner or the unassigned pool, never crash the
 * lead-capture path.
 */
export async function assignNextAgentForTeam(args: {
  teamId: string;
}): Promise<string | null> {
  try {
    const { data: memberRows, error: memberErr } = await supabaseAdmin
      .from("team_memberships")
      .select("agent_id")
      .eq("team_id", args.teamId);
    if (memberErr || !memberRows?.length) {
      if (memberErr) console.warn("[team-routing] member lookup:", memberErr.message);
      return null;
    }

    const memberIds = memberRows
      .map((r) => String((r as { agent_id: string }).agent_id))
      .filter(Boolean);

    if (memberIds.length === 0) return null;

    const { data: routingRows, error: routingErr } = await supabaseAdmin
      .from("agent_lead_routing")
      .select("agent_id, in_round_robin")
      .in("agent_id", memberIds);
    if (routingErr) {
      console.warn("[team-routing] routing lookup:", routingErr.message);
      return null;
    }

    const optedIn = new Map<string, boolean>();
    for (const r of routingRows ?? []) {
      const row = r as { agent_id: string | number; in_round_robin: boolean | null };
      optedIn.set(String(row.agent_id), Boolean(row.in_round_robin));
    }

    const members: TeamMemberRoutingRow[] = memberIds.map((id) => ({
      agentId: id,
      inRoundRobin: optedIn.get(id) ?? false,
    }));

    // Last-assignment timestamps come from contacts (same source the
    // solo-agent picker uses). Bounded select keeps this cheap for
    // pilot-scale teams.
    const lastAssignedAt = await fetchLastAssignmentMap(memberIds);
    return pickNextTeamMember({ members, lastAssignedAt });
  } catch (e) {
    console.warn("[team-routing] unexpected error:", e);
    return null;
  }
}

async function fetchLastAssignmentMap(
  memberIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabaseServer
      .from("contacts")
      .select("agent_id, created_at")
      .eq("source", IDX_LEAD_SOURCE)
      .in("agent_id", memberIds as string[])
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      console.warn("[team-routing] fetchLastAssignmentMap:", error.message);
      return new Map();
    }
    const map = new Map<string, string>();
    for (const row of (data ?? []) as Array<{ agent_id: string | null; created_at: string }>) {
      if (!row.agent_id) continue;
      const id = String(row.agent_id);
      // Rows are descending by created_at, so the first hit per agent is the most recent.
      if (!map.has(id)) map.set(id, row.created_at);
    }
    return map;
  } catch (e) {
    console.warn("[team-routing] fetchLastAssignmentMap threw:", e);
    return new Map();
  }
}
