import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildTeamBreakdown,
  EMPTY_MEMBER_METRICS,
  type MemberBreakdownRow,
  type MemberMetrics,
  type TeamBreakdown,
} from "./breakdown";
import type { TeamRole } from "./types";

/**
 * Server-side breakdown loader.
 *
 * Two phases:
 *   1. Resolve the team's roster (agentId + role)
 *   2. Fan out per-member count queries in parallel — contacts,
 *      tasks, transactions
 *
 * Falls back to an empty breakdown on any failure so the UI panel
 * stays renderable. The owner-only authorization check is the
 * caller's responsibility (route handler / server action).
 */
export async function loadTeamBreakdown(teamId: string): Promise<TeamBreakdown> {
  try {
    const { data: rosterRows, error: rosterErr } = await supabaseAdmin
      .from("team_memberships")
      .select("agent_id, role")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });
    if (rosterErr || !rosterRows?.length) {
      return buildTeamBreakdown([]);
    }

    const roster = (rosterRows as Array<{ agent_id: string; role: TeamRole }>).map(
      (r) => ({ agentId: String(r.agent_id), role: r.role }),
    );

    const metrics = await Promise.all(
      roster.map((m) => loadMemberMetrics(m.agentId)),
    );

    const rows: MemberBreakdownRow[] = roster.map((m, i) => ({
      agentId: m.agentId,
      role: m.role,
      ...metrics[i],
    }));

    return buildTeamBreakdown(rows);
  } catch (e) {
    console.warn("[teams.breakdown] unexpected error:", e);
    return buildTeamBreakdown([]);
  }
}

async function loadMemberMetrics(agentId: string): Promise<MemberMetrics> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

    const contacts = () =>
      supabaseAdmin
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId);

    const transactions = () =>
      supabaseAdmin
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId);

    const [
      { count: contactsTotal },
      { count: leadsHot },
      { count: tasksCompletedLast30d },
      { count: tasksOpen },
      { count: transactionsActive },
      { count: transactionsClosedYtd },
    ] = await Promise.all([
      contacts().neq("lifecycle_stage", "archived"),
      contacts().eq("rating", "hot"),
      supabaseAdmin
        .from("crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("status", "done")
        .gte("completed_at", thirtyDaysAgo),
      supabaseAdmin
        .from("crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("status", "open"),
      transactions().eq("status", "active"),
      transactions()
        .eq("status", "closed")
        .gte("closing_date_actual", yearStart),
    ]);

    return {
      contactsTotal: contactsTotal ?? 0,
      leadsHot: leadsHot ?? 0,
      tasksCompletedLast30d: tasksCompletedLast30d ?? 0,
      tasksOpen: tasksOpen ?? 0,
      transactionsActive: transactionsActive ?? 0,
      transactionsClosedYtd: transactionsClosedYtd ?? 0,
    };
  } catch (e) {
    console.warn("[teams.breakdown] loadMemberMetrics failed:", e);
    return { ...EMPTY_MEMBER_METRICS };
  }
}
