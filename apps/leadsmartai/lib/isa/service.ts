import "server-only";

import { IDX_LEAD_SOURCE } from "@/lib/leadAssignment/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabaseServer";
import { planHandoff, type HandoffReason, type HandoffResult } from "./handoff";
import {
  pickNextForNewLead,
  type TeamRoutingMember,
} from "./routing";

/**
 * Server-side service for the ISA workflow.
 *
 * Three flows:
 *   1. assignNewLeadForTeam — ISA-first router. Picks an ISA
 *      when one exists in the pool, falls through to a closer
 *   2. handoffContact — qualified-lead transition. Reassigns
 *      contacts.agent_id from ISA to closer + logs to
 *      contact_events
 *   3. listTeamMembersWithRoles — small read helper used by
 *      the routing path + dashboard surfaces
 */

/**
 * Pick the next agent for a brand-new inbound lead routed to a
 * team. ISA-first: returns the ISA when one's in the pool, or
 * the next closer when no ISAs are configured. Returns null
 * when nobody on the team is opted in.
 */
export async function assignNewLeadForTeam(args: {
  teamId: string;
}): Promise<{ agentId: string; pickedAs: "isa" | "closer" } | null> {
  const members = await loadTeamRoutingMembers(args.teamId);
  if (members.length === 0) return null;
  const lastAssignedAt = await fetchLastAssignmentMap(
    members.map((m) => m.agentId),
  );
  return pickNextForNewLead(members, lastAssignedAt);
}

/**
 * Hand off a contact from its current assignee (an ISA) to a
 * closer on the same team. Three steps:
 *   1. Resolve the current assignee + their role
 *   2. Run planHandoff to pick the receiving closer
 *   3. Update contacts.agent_id and append a contact_events row
 *
 * Returns the plan on success, or a structured failure code so
 * the caller (server action / API route) can surface a useful
 * message.
 */
export async function handoffContact(args: {
  contactId: string;
  teamId: string;
  reason?: HandoffReason;
}): Promise<HandoffResult> {
  // Current assignee.
  const { data: contactRow } = await supabaseAdmin
    .from("contacts")
    .select("agent_id")
    .eq("id", args.contactId)
    .maybeSingle();
  const currentAgentId = (contactRow as { agent_id?: string | null } | null)?.agent_id ?? null;
  if (!currentAgentId) {
    return { ok: false, reason: "from_not_isa" };
  }

  // Member shape for the planner.
  const members = await loadTeamRoutingMembers(args.teamId);
  const currentMember = members.find((m) => m.agentId === currentAgentId);
  if (!currentMember) {
    return { ok: false, reason: "from_not_isa" };
  }

  const lastAssignedAt = await fetchLastAssignmentMap(
    members.map((m) => m.agentId),
  );

  const planned = planHandoff({
    currentAssignee: {
      agentId: currentAgentId,
      role: currentMember.role,
    },
    members,
    lastAssignedAt,
    reason: args.reason,
  });
  if (!planned.ok) return planned;

  // Apply the reassignment + log the event in parallel.
  await Promise.all([
    supabaseAdmin
      .from("contacts")
      .update({ agent_id: planned.plan.toAgentId })
      .eq("id", args.contactId),
    supabaseAdmin
      .from("contact_events")
      .insert({
        contact_id: args.contactId,
        event_type: "isa_handoff",
        metadata: {
          from_agent_id: planned.plan.fromAgentId,
          to_agent_id: planned.plan.toAgentId,
          reason: planned.plan.reason,
          team_id: args.teamId,
        },
      }),
  ]);

  return planned;
}

// ── helpers ─────────────────────────────────────────────────────

async function loadTeamRoutingMembers(
  teamId: string,
): Promise<TeamRoutingMember[]> {
  const { data: memberRows, error: memberErr } = await supabaseAdmin
    .from("team_memberships")
    .select("agent_id, role")
    .eq("team_id", teamId);
  if (memberErr || !memberRows?.length) return [];

  const ids = memberRows
    .map((r) => String((r as { agent_id: string }).agent_id))
    .filter(Boolean);
  if (ids.length === 0) return [];

  const { data: routingRows, error: routingErr } = await supabaseAdmin
    .from("agent_lead_routing")
    .select("agent_id, in_round_robin")
    .in("agent_id", ids);
  if (routingErr) return [];

  const optedIn = new Map<string, boolean>();
  for (const r of routingRows ?? []) {
    const row = r as { agent_id: string | number; in_round_robin: boolean | null };
    optedIn.set(String(row.agent_id), Boolean(row.in_round_robin));
  }

  return memberRows.map((row) => {
    const r = row as { agent_id: string | number; role: TeamRoutingMember["role"] };
    const id = String(r.agent_id);
    return {
      agentId: id,
      role: r.role,
      inRoundRobin: optedIn.get(id) ?? false,
    };
  });
}

async function fetchLastAssignmentMap(
  agentIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  if (agentIds.length === 0) return new Map();
  try {
    const { data } = await supabaseServer
      .from("contacts")
      .select("agent_id, created_at")
      .eq("source", IDX_LEAD_SOURCE)
      .in("agent_id", agentIds as string[])
      .order("created_at", { ascending: false })
      .limit(1000);
    const map = new Map<string, string>();
    for (const row of (data ?? []) as Array<{
      agent_id: string | null;
      created_at: string;
    }>) {
      if (!row.agent_id) continue;
      const id = String(row.agent_id);
      if (!map.has(id)) map.set(id, row.created_at);
    }
    return map;
  } catch {
    return new Map();
  }
}
