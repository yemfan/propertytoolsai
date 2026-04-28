import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getAgentScopeForAgent } from "@/lib/teams/scope.server";

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const scope = await getAgentScopeForAgent(agentId);

    // Core lead aggregates (scoped to this agent or team roster)
    const { data: leadAgg, error: leadAggErr } = await supabaseServer
      .from("contacts")
      .select(
        "id, rating, engagement_score, last_activity_at"
      )
      .in("agent_id", scope.agentIds);

    if (leadAggErr) throw leadAggErr;

    const leads = (leadAgg as any[]) ?? [];

    const totalLeads = leads.length;
    const hotLeads = leads.filter((l) => String(l.rating ?? "").toLowerCase() === "hot").length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    // "Viewed reports today" → use lead_events for report_view in last 24h
    const { data: reportTodayData, error: reportTodayErr } = await supabaseServer
      .from("contact_events")
      .select("contact_id, event_type, created_at")
      .eq("event_type", "report_view")
      .gte("created_at", new Date(todayMs).toISOString());

    if (reportTodayErr) throw reportTodayErr;

    const leadsViewedReportsToday = new Set<number>();
    for (const ev of (reportTodayData as any[]) ?? []) {
      if (ev.contact_id != null) leadsViewedReportsToday.add(Number(ev.contact_id));
    }

    // Messages sent (automation_logs; legacy `communications` table was
    // dropped in the contacts-consolidation migration — that feature was
    // half-built per the audit. Silence 42P01 if a stale environment
    // still has it or reverts; otherwise the automation_logs count is
    // the canonical source of truth going forward).
    const commRes = await supabaseServer
      .from("communications")
      .select("id", { count: "exact", head: true });
    const commCount =
      commRes.error && /does not exist|42P01/i.test(commRes.error.message ?? "")
        ? 0
        : (commRes.count ?? 0);

    const { count: autoCount, error: autoErr } = await supabaseServer
      .from("automation_logs")
      .select("id", { count: "exact", head: true });
    if (autoErr) throw autoErr;

    const messagesSent = commCount + (autoCount ?? 0);

    // Avg engagement score
    const scores = leads
      .map((l) => (typeof l.engagement_score === "number" ? l.engagement_score : null))
      .filter((v) => v != null) as number[];
    const avgEngagementScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    // Inactive leads (no activity for 7+ days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const inactive7Days = leads.filter((l) => {
      if (!l.last_activity_at) return false;
      const ts = new Date(String(l.last_activity_at)).getTime();
      return ts <= sevenDaysAgo;
    }).length;

    // Recent activity feed (lead_events)
    const { data: events, error: eventsErr } = await supabaseServer
      .from("contact_events")
      .select("id, contact_id, event_type, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (eventsErr) throw eventsErr;

    return NextResponse.json({
      ok: true,
      metrics: {
        totalLeads,
        hotLeads,
        avgEngagementScore,
        messagesSent,
        leadsViewedReportsToday: leadsViewedReportsToday.size,
        inactive7Days,
      },
      recentEvents: events ?? [],
    });
  } catch (e: any) {
    console.error("dashboard summary error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

