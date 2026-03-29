import { supabaseAdmin } from "@/lib/supabase/admin";
import { avg, isClosedLeadStatus, minutesBetween, rowRevenue } from "./helpers";
import type {
  AgentPerformanceRow,
  FunnelPerformance,
  PerformanceOverview,
  SourcePerformanceRow,
} from "./types";

type ConversionRow = {
  lead_id: string;
  agent_id?: string | null;
  gross_commission?: number | null;
  recurring_revenue?: number | null;
};

async function fetchConversions(): Promise<ConversionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("lead_conversions")
    .select("lead_id, agent_id, gross_commission, recurring_revenue");
  if (error) {
    console.warn("[performance] lead_conversions:", error.message);
    return [];
  }
  return (data ?? []) as ConversionRow[];
}

async function fetchActiveAgents(): Promise<Array<{ id: string; name: string }>> {
  const { data: profiles, error: apErr } = await supabaseAdmin
    .from("agent_profiles")
    .select("agent_id, full_name")
    .eq("is_active", true);

  if (!apErr && profiles?.length) {
    return profiles.map((a: { agent_id: string; full_name: string | null }) => ({
      id: String(a.agent_id),
      name: String(a.full_name ?? "Agent"),
    }));
  }

  const { data: agents, error: agErr } = await supabaseAdmin
    .from("agents")
    .select("id, full_name, name")
    .limit(10_000);

  if (!agErr && agents?.length) {
    return agents.map((a: { id: unknown; full_name?: string | null; name?: string | null }) => ({
      id: String(a.id),
      name: String(a.full_name ?? a.name ?? `Agent ${a.id}`),
    }));
  }

  return [];
}

export async function getPerformanceOverview(): Promise<PerformanceOverview> {
  const [{ data: leads }, conversions, { data: conversations }] = await Promise.all([
    supabaseAdmin
      .from("leads")
      .select("id, lead_score, lead_temperature, created_at"),
    fetchConversions(),
    supabaseAdmin.from("lead_conversations").select("lead_id, direction, created_at"),
  ]);

  const leadRows = leads ?? [];
  const conversionRows = conversions;
  const conversationRows = conversations ?? [];

  const grossRevenue = conversionRows.reduce((sum, row) => sum + rowRevenue(row), 0);

  const leadFirstInbound = new Map<string, string>();
  const leadFirstOutbound = new Map<string, string>();

  for (const row of conversationRows) {
    const lid = String(row.lead_id);
    if (row.direction === "inbound" && !leadFirstInbound.has(lid)) {
      leadFirstInbound.set(lid, row.created_at as string);
    }
    if (row.direction === "outbound" && !leadFirstOutbound.has(lid)) {
      leadFirstOutbound.set(lid, row.created_at as string);
    }
  }

  const responseMins: number[] = [];
  for (const lead of leadRows) {
    const lid = String((lead as { id: unknown }).id);
    const mins = minutesBetween(leadFirstInbound.get(lid), leadFirstOutbound.get(lid));
    if (typeof mins === "number") responseMins.push(mins);
  }

  const fallbackClosed = leadRows.filter((l) => isClosedLeadStatus(l as Record<string, unknown>)).length;
  const uniqueConvLeads = new Set(conversionRows.map((r) => String(r.lead_id)));
  const totalConversions =
    uniqueConvLeads.size > 0 ? uniqueConvLeads.size : fallbackClosed;

  return {
    totalLeads: leadRows.length,
    hotLeads: leadRows.filter((l: { lead_temperature?: string | null }) => l.lead_temperature === "hot")
      .length,
    warmLeads: leadRows.filter((l: { lead_temperature?: string | null }) => l.lead_temperature === "warm")
      .length,
    coldLeads: leadRows.filter((l: { lead_temperature?: string | null }) => l.lead_temperature === "cold")
      .length,
    totalConversions,
    grossRevenue,
    avgLeadScore: Number(
      avg(leadRows.map((l: { lead_score?: unknown }) => Number(l.lead_score ?? 0))).toFixed(1)
    ),
    avgResponseMinutes: Number(avg(responseMins).toFixed(1)),
  };
}

export async function getPerformanceBySource(): Promise<SourcePerformanceRow[]> {
  const [{ data: leads }, conversions] = await Promise.all([
    supabaseAdmin.from("leads").select("id, source, lead_score, lead_temperature"),
    fetchConversions(),
  ]);

  const conversionByLead = new Map<string, number>();
  for (const row of conversions) {
    conversionByLead.set(String(row.lead_id), rowRevenue(row));
  }

  const closedLeadIds = new Set(
    (leads ?? [])
      .filter((l) => isClosedLeadStatus(l as Record<string, unknown>))
      .map((l) => String((l as { id: unknown }).id))
  );

  const map = new Map<string, SourcePerformanceRow>();
  for (const lead of leads ?? []) {
    const source = String((lead as { source?: string | null }).source || "unknown");
    if (!map.has(source)) {
      map.set(source, {
        source,
        leads: 0,
        hotLeads: 0,
        conversions: 0,
        grossRevenue: 0,
        avgLeadScore: 0,
        conversionRate: 0,
      });
    }
    const row = map.get(source)!;
    row.leads += 1;
    if ((lead as { lead_temperature?: string | null }).lead_temperature === "hot") row.hotLeads += 1;
    row.avgLeadScore += Number((lead as { lead_score?: unknown }).lead_score ?? 0);

    const lid = String((lead as { id: unknown }).id);
    if (conversionByLead.has(lid)) {
      row.conversions += 1;
      row.grossRevenue += conversionByLead.get(lid) ?? 0;
    } else if (closedLeadIds.has(lid)) {
      row.conversions += 1;
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      avgLeadScore: Number((row.avgLeadScore / Math.max(row.leads, 1)).toFixed(1)),
      conversionRate: Number(((row.conversions / Math.max(row.leads, 1)) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue || b.leads - a.leads);
}

export async function getPerformanceByAgent(): Promise<AgentPerformanceRow[]> {
  const [agentsList, { data: leads }, conversions, { data: conversations }] = await Promise.all([
    fetchActiveAgents(),
    supabaseAdmin.from("leads").select("id, assigned_agent_id, lead_temperature"),
    fetchConversions(),
    supabaseAdmin.from("lead_conversations").select("lead_id, direction, created_at"),
  ]);

  const leadsByAgent = new Map<string, any[]>();
  for (const lead of leads ?? []) {
    const id = (lead as { assigned_agent_id?: string | null }).assigned_agent_id;
    if (!id) continue;
    const sid = String(id);
    if (!leadsByAgent.has(sid)) leadsByAgent.set(sid, []);
    leadsByAgent.get(sid)!.push(lead);
  }

  const conversionsByAgent = new Map<string, ConversionRow[]>();
  for (const row of conversions) {
    const id = row.agent_id;
    if (!id) continue;
    const sid = String(id);
    if (!conversionsByAgent.has(sid)) conversionsByAgent.set(sid, []);
    conversionsByAgent.get(sid)!.push(row);
  }

  const convByLead = new Map<string, any[]>();
  for (const row of conversations ?? []) {
    const lid = String(row.lead_id);
    if (!convByLead.has(lid)) convByLead.set(lid, []);
    convByLead.get(lid)!.push(row);
  }

  const agentIds = new Set<string>([
    ...agentsList.map((a) => a.id),
    ...leadsByAgent.keys(),
    ...conversionsByAgent.keys(),
  ]);

  const nameById = new Map(agentsList.map((a) => [a.id, a.name] as const));

  const rows: AgentPerformanceRow[] = [];

  for (const agentId of agentIds) {
    const agentLeads = leadsByAgent.get(agentId) || [];
    const agentConversions = conversionsByAgent.get(agentId) || [];

    const grossRevenue = agentConversions.reduce((sum, row) => sum + rowRevenue(row), 0);

    let repliesSent = 0;
    const responseTimes: number[] = [];

    for (const lead of agentLeads) {
      const rowsConv = (convByLead.get(String((lead as { id: unknown }).id)) || []).sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const firstInbound = rowsConv.find((r: { direction: string }) => r.direction === "inbound");
      const firstOutbound = rowsConv.find((r: { direction: string }) => r.direction === "outbound");
      const mins = minutesBetween(firstInbound?.created_at, firstOutbound?.created_at);
      if (typeof mins === "number") responseTimes.push(mins);
      repliesSent += rowsConv.filter((r: { direction: string }) => r.direction === "outbound").length;
    }

    const closedWithoutConversionRow = agentLeads.filter((l) =>
      isClosedLeadStatus(l as Record<string, unknown>)
    ).length;
    const uniqueAgentConvLeads = new Set(agentConversions.map((r) => String(r.lead_id)));
    const conversionCount =
      uniqueAgentConvLeads.size > 0 ? uniqueAgentConvLeads.size : closedWithoutConversionRow;

    rows.push({
      agentId,
      agentName: nameById.get(agentId) ?? `Agent ${agentId}`,
      leadsAssigned: agentLeads.length,
      hotLeads: agentLeads.filter(
        (l: { lead_temperature?: string | null }) => l.lead_temperature === "hot"
      ).length,
      repliesSent,
      conversions: conversionCount,
      grossRevenue,
      avgResponseMinutes: Number(avg(responseTimes).toFixed(1)),
      closeRate: Number(((conversionCount / Math.max(agentLeads.length, 1)) * 100).toFixed(1)),
    });
  }

  return rows.sort((a, b) => b.grossRevenue - a.grossRevenue || b.closeRate - a.closeRate);
}

export async function getPerformanceFunnel(): Promise<FunnelPerformance> {
  const [
    { data: toolEvents, error: toolErr },
    { data: leads },
    { data: conversations },
    convData,
    { data: actRows },
  ] = await Promise.all([
      supabaseAdmin.from("tool_events").select("session_id").limit(100_000),
      supabaseAdmin.from("leads").select("id"),
      supabaseAdmin.from("lead_conversations").select("lead_id"),
      fetchConversions(),
      supabaseAdmin.from("lead_activity_events").select("lead_id, event_type, metadata").limit(50_000),
    ]);

  if (toolErr) {
    console.warn("[performance] tool_events:", toolErr.message);
  }

  const visitors = new Set(
    (toolEvents ?? []).map((e: { session_id?: string | null }) => e.session_id).filter(Boolean)
  ).size;

  const uniqueConversationLeads = new Set((conversations ?? []).map((x: { lead_id: unknown }) => String(x.lead_id)));
  const uniqueConversionLeads = new Set(convData.map((x) => String(x.lead_id)));

  const appointmentSet = new Set<string>();
  for (const row of actRows ?? []) {
    const et = String((row as { event_type?: string }).event_type ?? "");
    const meta = (row as { metadata?: Record<string, unknown> }).metadata ?? {};
    const action = String(meta.actionType ?? meta.action_type ?? "");
    if (
      et === "tour_requested" ||
      et === "appointment_booked" ||
      et === "schedule_tour" ||
      action === "schedule_tour"
    ) {
      appointmentSet.add(String((row as { lead_id: unknown }).lead_id));
    }
  }

  const leadRows = leads ?? [];
  const closedFallback = leadRows.filter((l) => isClosedLeadStatus(l as Record<string, unknown>)).length;
  const conversionCount =
    uniqueConversionLeads.size > 0 ? uniqueConversionLeads.size : closedFallback;

  return {
    visitors,
    leads: leadRows.length,
    conversations: uniqueConversationLeads.size,
    appointments: appointmentSet.size,
    conversions: conversionCount,
  };
}
