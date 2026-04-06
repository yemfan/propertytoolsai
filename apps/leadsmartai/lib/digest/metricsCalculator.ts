import { supabaseAdmin } from "@/lib/supabase/admin";
import type { WeeklyMetrics } from "./types";

/**
 * Compute weekly performance metrics for a single agent.
 * All queries use supabaseAdmin (service role) to bypass RLS.
 */
export async function computeWeeklyMetrics(
  agentId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyMetrics> {
  const aid = agentId as unknown as number;

  // Run independent counts in parallel.
  const [
    leadsContacted,
    smsSent,
    emailsSent,
    callsLogged,
    tasksCompleted,
    appointmentsBooked,
    hotLeads,
    avgResponseTime,
    missedCalls,
    overdueTasks,
    unreadConversations,
  ] = await Promise.all([
    countLeadsContacted(aid, weekStart, weekEnd),
    countSmsSent(aid, weekStart, weekEnd),
    countEmailsSent(aid, weekStart, weekEnd),
    countCallsLogged(aid, weekStart, weekEnd),
    countTasksCompleted(aid, weekStart, weekEnd),
    countAppointmentsBooked(aid, weekStart, weekEnd),
    countHotLeadsGenerated(aid, weekStart, weekEnd),
    calcAvgResponseTime(aid, weekStart, weekEnd),
    countMissedCallsUnresolved(aid),
    countOverdueTasks(aid),
    countUnreadConversations(aid),
  ]);

  return {
    leads_contacted: leadsContacted,
    sms_sent: smsSent,
    emails_sent: emailsSent,
    calls_logged: callsLogged,
    tasks_completed: tasksCompleted,
    appointments_booked: appointmentsBooked,
    hot_leads_generated: hotLeads,
    avg_response_time_minutes: avgResponseTime,
    missed_calls_unresolved: missedCalls,
    overdue_tasks: overdueTasks,
    unread_conversations: unreadConversations,
  };
}

async function countLeadsContacted(aid: number, start: string, end: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("communications")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", aid)
    .eq("status", "sent")
    .gte("created_at", start)
    .lt("created_at", end);
  return count ?? 0;
}

async function countSmsSent(aid: number, start: string, end: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("sms_messages")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", aid)
    .eq("direction", "outbound")
    .gte("created_at", start)
    .lt("created_at", end);
  return count ?? 0;
}

async function countEmailsSent(aid: number, start: string, end: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", aid)
    .eq("direction", "outbound")
    .gte("created_at", start)
    .lt("created_at", end);
  return count ?? 0;
}

async function countCallsLogged(aid: number, start: string, end: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("lead_calls")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", aid)
    .gte("created_at", start)
    .lt("created_at", end);
  return count ?? 0;
}

async function countTasksCompleted(aid: number, start: string, end: string): Promise<number> {
  // Check lead_tasks (newer) first, fall back to tasks (legacy).
  const { count: ltCount } = await supabaseAdmin
    .from("lead_tasks")
    .select("id", { count: "exact", head: true })
    .eq("assigned_agent_id", aid)
    .eq("status", "closed")
    .gte("updated_at", start)
    .lt("updated_at", end);

  const { count: tCount } = await supabaseAdmin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", aid)
    .eq("status", "done")
    .gte("updated_at", start)
    .lt("updated_at", end);

  return (ltCount ?? 0) + (tCount ?? 0);
}

async function countAppointmentsBooked(aid: number, start: string, end: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("lead_calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", aid)
    .gte("created_at", start)
    .lt("created_at", end);
  return count ?? 0;
}

async function countHotLeadsGenerated(aid: number, start: string, end: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", aid)
    .eq("rating", "hot")
    .gte("created_at", start)
    .lt("created_at", end);
  return count ?? 0;
}

async function calcAvgResponseTime(aid: number, start: string, end: string): Promise<number | null> {
  // Average minutes between lead.created_at and first outbound communication.
  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("id, created_at")
    .eq("agent_id", aid)
    .gte("created_at", start)
    .lt("created_at", end)
    .limit(200);

  if (!leads?.length) return null;

  let total = 0;
  let count = 0;

  for (const lead of leads) {
    const { data: firstComm } = await supabaseAdmin
      .from("communications")
      .select("created_at")
      .eq("lead_id", (lead as { id: number }).id)
      .eq("agent_id", aid)
      .eq("status", "sent")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstComm?.created_at && lead.created_at) {
      const diff =
        new Date(String(firstComm.created_at)).getTime() -
        new Date(String(lead.created_at)).getTime();
      if (diff >= 0) {
        total += diff / 60_000;
        count++;
      }
    }
  }

  return count > 0 ? Math.round(total / count) : null;
}

async function countMissedCallsUnresolved(aid: number): Promise<number> {
  const { count } = await supabaseAdmin
    .from("agent_inbox_notifications")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", aid)
    .eq("type", "missed_call")
    .eq("read", false);
  return count ?? 0;
}

async function countOverdueTasks(aid: number): Promise<number> {
  const now = new Date().toISOString();
  const { count } = await supabaseAdmin
    .from("lead_tasks")
    .select("id", { count: "exact", head: true })
    .eq("assigned_agent_id", aid)
    .eq("status", "open")
    .lt("due_at", now);
  return count ?? 0;
}

async function countUnreadConversations(aid: number): Promise<number> {
  const { count } = await supabaseAdmin
    .from("agent_inbox_notifications")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", aid)
    .eq("read", false);
  return count ?? 0;
}
