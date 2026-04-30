import { supabaseServer } from "@/lib/supabaseServer";
import {
  generateDailyBriefing,
  type BriefingKind,
  type BriefingOutput,
} from "@/lib/dailyBriefingAI";

type LeadRow = {
  id: number;
  name: string | null;
  email: string | null;
  property_address: string | null;
  rating: string | null;
  engagement_score: number | null;
  last_activity_at: string | null;
};

type TaskRow = {
  id: string;
  title: string | null;
  type: string | null;
  status: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string | null;
};

function startOfTodayUtcIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayUtcIso(): string {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

function todayDate(): string {
  return startOfTodayUtcIso().slice(0, 10);
}

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Generates a briefing of the given kind for an agent. Idempotent
 * per agent + kind + UTC day — if a row already exists for today
 * we return the existing row with `skipped: true`.
 *
 * The morning path also writes derived tasks to `tasks` (call-this-
 * lead, follow-up-this-stale-lead). The evening path is read-only
 * — it summarizes the day, doesn't create new work.
 */
export async function createDailyBriefingForAgent(
  agentId: string,
  kind: BriefingKind = "morning",
) {
  const todayIso = startOfTodayUtcIso();

  const { data: existing } = await supabaseServer
    .from("daily_briefings")
    .select("id,agent_id,kind,headline,summary,insights,created_at")
    .eq("agent_id", agentId)
    .eq("kind", kind)
    .gte("created_at", todayIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { skipped: true, briefing: existing };
  }

  const ai =
    kind === "morning"
      ? await generateMorning(agentId)
      : await generateEvening(agentId);

  const { data: inserted, error: insertErr } = await supabaseServer
    .from("daily_briefings")
    .insert({
      agent_id: agentId,
      kind,
      headline: ai.headline,
      summary: ai.summary,
      insights: ai.insights,
    })
    .select("id,agent_id,kind,headline,summary,insights,created_at")
    .single();
  if (insertErr) throw insertErr;

  if (kind === "morning") {
    await writeMorningTasks(agentId, ai);
  }

  return { skipped: false, briefing: inserted };
}

async function generateMorning(agentId: string): Promise<BriefingOutput> {
  const { data: leads, error: leadsErr } = await supabaseServer
    .from("contacts")
    .select("id,name,email,property_address,rating,engagement_score,last_activity_at")
    .eq("agent_id", agentId)
    .limit(500);
  if (leadsErr) throw leadsErr;

  const rows = (leads as LeadRow[] | null) ?? [];

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

  return generateDailyBriefing({
    kind: "morning",
    totalLeads: rows.length,
    hotLeads,
    highEngagementLeads,
    inactiveLeads,
  });
}

async function generateEvening(agentId: string): Promise<BriefingOutput> {
  const startUtc = startOfTodayUtcIso();
  const endUtc = endOfTodayUtcIso();
  const todayStr = todayDate();

  const { data: completedRaw } = await supabaseServer
    .from("tasks")
    .select("id,title,type,status,due_date,completed_at,created_at")
    .eq("agent_id", agentId)
    .eq("status", "completed")
    .gte("completed_at", startUtc)
    .lte("completed_at", endUtc)
    .limit(50);
  const completed = ((completedRaw as TaskRow[] | null) ?? []).map((t) => ({
    title: t.title || "Task",
    type: t.type || "task",
  }));

  const { data: missedRaw } = await supabaseServer
    .from("tasks")
    .select("id,title,type,status,due_date,completed_at,created_at")
    .eq("agent_id", agentId)
    .eq("due_date", todayStr)
    .neq("status", "completed")
    .limit(50);
  const missed = ((missedRaw as TaskRow[] | null) ?? []).map((t) => ({
    title: t.title || "Task",
    type: t.type || "task",
  }));

  const tomorrowStr = (() => {
    const d = new Date(startUtc);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const { data: tomorrowRaw } = await supabaseServer
    .from("tasks")
    .select("id,title,type,status,due_date,completed_at,created_at")
    .eq("agent_id", agentId)
    .eq("due_date", tomorrowStr)
    .neq("status", "completed")
    .limit(20);
  const tomorrow = ((tomorrowRaw as TaskRow[] | null) ?? []).map((t) => ({
    title: t.title || "Task",
    type: t.type || "task",
  }));

  // Conversation count today. `communications` may not exist on
  // every env; fall back to 0 silently.
  let conversationsCount = 0;
  try {
    const { count } = await supabaseServer
      .from("communications")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .gte("created_at", startUtc)
      .lte("created_at", endUtc);
    conversationsCount = count ?? 0;
  } catch {
    conversationsCount = 0;
  }

  const { count: newLeadsCount } = await supabaseServer
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);

  return generateDailyBriefing({
    kind: "evening",
    completedTasks: completed,
    missedTasks: missed,
    conversationsCount,
    newLeadsCount: newLeadsCount ?? 0,
    tomorrowTasks: tomorrow,
  });
}

async function writeMorningTasks(
  agentId: string,
  ai: BriefingOutput,
): Promise<void> {
  const day = todayDate();
  const tasks: Array<{
    agent_id: string;
    contact_id: number | null;
    title: string;
    description: string;
    type: string;
    due_date: string;
  }> = [];

  for (const l of ai.insights.topHotLeads ?? []) {
    tasks.push({
      agent_id: agentId,
      contact_id: null,
      title: `Call hot lead: ${l.name}`,
      description: `High-intent lead at ${l.address || "no address"}. Engagement score ${l.score}.`,
      type: "call",
      due_date: day,
    });
  }
  for (const l of ai.insights.needsFollowUp ?? []) {
    tasks.push({
      agent_id: agentId,
      contact_id: null,
      title: `Follow up with inactive lead: ${l.name}`,
      description: `Lead has been inactive for ${l.daysInactive} days at ${l.address || "no address"}.`,
      type: "follow_up",
      due_date: day,
    });
  }

  if (!tasks.length) return;
  try {
    await supabaseServer.from("tasks").insert(tasks);
  } catch {
    // Ignore duplicate-constraint errors — same hot lead two days in a row.
  }
}
