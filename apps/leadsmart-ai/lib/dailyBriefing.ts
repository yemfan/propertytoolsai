import { supabaseServer } from "@/lib/supabaseServer";
import { generateDailyBriefing } from "@/lib/dailyBriefingAI";

type LeadRow = {
  id: number;
  name: string | null;
  email: string | null;
  property_address: string | null;
  rating: string | null;
  engagement_score: number | null;
  last_activity_at: string | null;
};

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export async function createDailyBriefingForAgent(agentId: string) {
  const todayIso = startOfTodayIso();
  const todayDate = todayIso.slice(0, 10);

  // Avoid duplicate sends/records for same day.
  const { data: existing } = await supabaseServer
    .from("daily_briefings")
    .select("id,summary,insights,created_at")
    .eq("agent_id", agentId)
    .gte("created_at", todayIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { skipped: true, briefing: existing };
  }

  const { data: leads, error: leadsErr } = await supabaseServer
    .from("leads")
    .select("id,name,email,property_address,rating,engagement_score,last_activity_at")
    .eq("agent_id", agentId)
    .limit(500);
  if (leadsErr) throw leadsErr;

  const rows = ((leads as any[]) ?? []) as LeadRow[];

  const hotLeads = rows
    .filter((l) => String(l.rating ?? "").toLowerCase() === "hot")
    .sort((a, b) => Number(b.engagement_score ?? 0) - Number(a.engagement_score ?? 0))
    .slice(0, 5)
    .map((l) => ({
      name: l.name || l.email || `Lead #${l.id}`,
      score: Number(l.engagement_score ?? 0),
      address: l.property_address || "",
    }));

  const highEngagementLeads = rows
    .filter((l) => Number(l.engagement_score ?? 0) >= 70)
    .sort((a, b) => Number(b.engagement_score ?? 0) - Number(a.engagement_score ?? 0))
    .slice(0, 5)
    .map((l) => ({
      name: l.name || l.email || `Lead #${l.id}`,
      score: Number(l.engagement_score ?? 0),
      address: l.property_address || "",
    }));

  const inactiveLeads = rows
    .filter((l) => daysSince(l.last_activity_at) >= 7)
    .sort((a, b) => daysSince(b.last_activity_at) - daysSince(a.last_activity_at))
    .slice(0, 5)
    .map((l) => ({
      name: l.name || l.email || `Lead #${l.id}`,
      daysInactive: daysSince(l.last_activity_at),
      address: l.property_address || "",
    }));

  const ai = await generateDailyBriefing({
    totalLeads: rows.length,
    hotLeads,
    highEngagementLeads,
    inactiveLeads,
  });

  const { data: inserted, error: insertErr } = await supabaseServer
    .from("daily_briefings")
    .insert({
      agent_id: agentId,
      summary: ai.summary,
      insights: ai.insights,
    })
    .select("id,agent_id,summary,insights,created_at")
    .single();
  if (insertErr) throw insertErr;

  // Derive actionable tasks from briefing + lead sets.
  const tasks: {
    agent_id: string;
    lead_id: number | null;
    title: string;
    description: string;
    type: string;
    due_date: string;
  }[] = [];

  for (const l of hotLeads) {
    const lead = rows.find(
      (r) => (r.name || r.email || `Lead #${r.id}`) === l.name
    );
    tasks.push({
      agent_id: agentId,
      lead_id: lead ? Number(lead.id) : null,
      title: `Call hot lead: ${l.name}`,
      description: `High-intent lead at ${l.address || "no address"}. Engagement score ${l.score}.`,
      type: "call",
      due_date: todayDate,
    });
  }

  for (const l of inactiveLeads) {
    const lead = rows.find(
      (r) => (r.name || r.email || `Lead #${r.id}`) === l.name
    );
    tasks.push({
      agent_id: agentId,
      lead_id: lead ? Number(lead.id) : null,
      title: `Follow up with inactive lead: ${l.name}`,
      description: `Lead has been inactive for ${l.daysInactive} days at ${l.address || "no address"}.`,
      type: "follow_up",
      due_date: todayDate,
    });
  }

  // Best-effort insert, ignore duplicates (unique index).
  if (tasks.length) {
    try {
      await supabaseServer.from("tasks").insert(tasks as any);
    } catch {
      // ignore duplicate constraint errors
    }
  }

  return { skipped: false, briefing: inserted };
}

