import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/authFromRequest";

async function getAgentIdForUser(userId: string) {
  try {
    const { data: agent } = await supabaseServer
      .from("agents")
      .select("id,auth_user_id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    return (agent as any)?.id ?? null;
  } catch {
    // legacy schema may not have auth_user_id
    return null;
  }
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const agentId = await getAgentIdForUser(user.id);
    if (!agentId) {
      return NextResponse.json({ ok: true, metrics: {}, alerts: [] });
    }

    const todayIso = startOfTodayIso();
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      tasksDoneRes,
      tasksSkippedRes,
      tasksPendingRes,
      leadsRes,
      eventsRes,
      commsRes,
    ] = await Promise.all([
      supabaseServer
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("status", "done")
        .gte("updated_at", sevenDaysAgoIso),
      supabaseServer
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("status", "skipped")
        .gte("updated_at", sevenDaysAgoIso),
      supabaseServer
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("status", "pending"),
      supabaseServer
        .from("contacts")
        .select("id,rating,engagement_score,created_at,last_activity_at", { count: "exact" })
        .eq("agent_id", agentId)
        .limit(500),
      supabaseServer
        .from("contact_events")
        .select("contact_id,event_type,created_at")
        .gte("created_at", sevenDaysAgoIso)
        .limit(2000),
      supabaseServer
        .from("communications")
        .select("contact_id,created_at")
        .eq("agent_id", agentId)
        .gte("created_at", sevenDaysAgoIso)
        .limit(2000),
    ]);

    const tasksCompleted = tasksDoneRes.count ?? 0;
    const tasksSkipped = tasksSkippedRes.count ?? 0;
    const tasksPending = tasksPendingRes.count ?? 0;
    const tasksTotal = tasksCompleted + tasksSkipped + tasksPending;
    const completionRate =
      tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

    const leads = (leadsRes.data as any[]) ?? [];
    const totalLeads = leadsRes.count ?? leads.length;
    const hotLeads = leads.filter(
      (l) => String(l.rating ?? "").toLowerCase() === "hot"
    ).length;
    const highEngagementLeads = leads.filter(
      (l) => Number(l.engagement_score ?? 0) >= 70
    ).length;

    const events = (eventsRes.data as any[]) ?? [];
    const comms = (commsRes.data as any[]) ?? [];

    // Response speed: time from lead.created_at to first communication.
    const commByLead = new Map<number, Date>();
    for (const c of comms) {
      const lid = Number(c.contact_id);
      if (!lid) continue;
      const dt = new Date(String(c.created_at));
      const existing = commByLead.get(lid);
      if (!existing || dt < existing) commByLead.set(lid, dt);
    }

    const responseMinutes: number[] = [];
    for (const l of leads) {
      const lid = Number(l.id);
      const firstComm = commByLead.get(lid);
      if (!firstComm) continue;
      const createdAt = new Date(String(l.created_at));
      const diffMs = firstComm.getTime() - createdAt.getTime();
      if (diffMs >= 0) responseMinutes.push(Math.round(diffMs / 60000));
    }

    const avgResponseTime =
      responseMinutes.length > 0
        ? Math.round(responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length)
        : null;
    const fastestResponse = responseMinutes.length
      ? Math.min(...responseMinutes)
      : null;
    const slowestResponse = responseMinutes.length
      ? Math.max(...responseMinutes)
      : null;

    // Conversion insight: high-engagement leads (>70) that have any communication.
    const highScoreLeadIds = new Set(
      leads.filter((l) => Number(l.engagement_score ?? 0) >= 70).map((l) => Number(l.id))
    );
    let highScoreWithResponse = 0;
    for (const [lid] of commByLead) {
      if (highScoreLeadIds.has(lid)) highScoreWithResponse++;
    }
    const highScoreLeadsCount = highScoreLeadIds.size;
    const highScoreRespondedPct =
      highScoreLeadsCount > 0
        ? Math.round((highScoreWithResponse / highScoreLeadsCount) * 100)
        : 0;

    // Missed opportunities: hot leads created in last 24h with no comms.
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const commLeadIds = new Set<number>();
    for (const [lid] of commByLead) commLeadIds.add(lid);
    const missedHot = leads.filter((l) => {
      const isHot = String(l.rating ?? "").toLowerCase() === "hot";
      if (!isHot) return false;
      const created = new Date(String(l.created_at));
      if (!(created >= since24h)) return false;
      const lid = Number(l.id);
      return !commLeadIds.has(lid);
    }).length;

    const alerts: string[] = [];
    if (missedHot > 0) {
      alerts.push(`⚠️ You missed ${missedHot} hot leads in the last 24 hours.`);
    }

    const metrics = {
      productivity: {
        tasksCompleted,
        tasksSkipped,
        tasksPending,
        completionRate,
      },
      leads: {
        totalLeads,
        hotLeads,
        highEngagementLeads,
      },
      response: {
        avgMinutes: avgResponseTime,
        fastestMinutes: fastestResponse,
        slowestMinutes: slowestResponse,
      },
      conversion: {
        highScoreLeads: highScoreLeadsCount,
        highScoreRespondedPct,
      },
      missedOpportunities: {
        hotNoAction24h: missedHot,
      },
    };

    return NextResponse.json({ ok: true, metrics, alerts });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

