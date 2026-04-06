import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeWeeklyMetrics } from "./metricsCalculator";
import { generateInsights } from "./insightRules";
import { insertAgentInboxNotification } from "@/lib/notifications/agentNotifications";
import type { DigestPayload, PerformanceDigestRow } from "./types";

function getLastWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  // Monday of this week
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
  thisMonday.setUTCHours(0, 0, 0, 0);
  // Last Monday
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);

  return {
    weekStart: lastMonday.toISOString().slice(0, 10),
    weekEnd: thisMonday.toISOString().slice(0, 10),
  };
}

function buildTitle(metrics: ReturnType<typeof computeWeeklyMetrics> extends Promise<infer T> ? T : never): string {
  const total = metrics.leads_contacted + metrics.sms_sent + metrics.emails_sent + metrics.calls_logged;
  if (total === 0) return "Your weekly recap — time to ramp up!";
  if (metrics.hot_leads_generated >= 3) return "Hot week! Your pipeline is heating up";
  if (metrics.tasks_completed >= 10) return "Productive week — great execution!";
  return "Your weekly performance recap";
}

function buildBody(
  metrics: ReturnType<typeof computeWeeklyMetrics> extends Promise<infer T> ? T : never,
  insightCount: number
): string {
  const parts: string[] = [];
  if (metrics.leads_contacted > 0) parts.push(`${metrics.leads_contacted} leads contacted`);
  if (metrics.tasks_completed > 0) parts.push(`${metrics.tasks_completed} tasks done`);
  if (metrics.hot_leads_generated > 0) parts.push(`${metrics.hot_leads_generated} hot leads`);
  if (metrics.appointments_booked > 0) parts.push(`${metrics.appointments_booked} appointments`);

  const summary = parts.length ? parts.join(", ") + "." : "No activity recorded this week.";
  const insightNote = insightCount > 0 ? ` ${insightCount} insight${insightCount > 1 ? "s" : ""} for you.` : "";
  return summary + insightNote;
}

/**
 * Build and store a weekly digest for one agent.
 * Returns the created digest row, or null if already exists.
 */
export async function buildDigestForAgent(
  agentId: string,
  range?: { weekStart: string; weekEnd: string }
): Promise<PerformanceDigestRow | null> {
  const { weekStart, weekEnd } = range ?? getLastWeekRange();

  // Skip if already generated.
  const { data: existing } = await supabaseAdmin
    .from("performance_digests")
    .select("id")
    .eq("agent_id", agentId as unknown as number)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing) return null;

  const metrics = await computeWeeklyMetrics(agentId, weekStart, weekEnd);
  const insights = generateInsights(metrics);
  const title = buildTitle(metrics);
  const body = buildBody(metrics, insights.length);

  const payload: DigestPayload = {
    metrics,
    insights,
    week_start: weekStart,
    week_end: weekEnd,
    agent_id: agentId,
  };

  const { data, error } = await supabaseAdmin
    .from("performance_digests")
    .insert({
      agent_id: agentId as unknown as number,
      week_start: weekStart,
      week_end: weekEnd,
      title,
      body,
      metrics,
      insights,
      payload_json: payload,
    } as Record<string, unknown>)
    .select("*")
    .single();

  if (error) {
    console.error("buildDigestForAgent: insert failed", error);
    return null;
  }

  return data as unknown as PerformanceDigestRow;
}

/**
 * Build digests for ALL agents and send push notifications.
 * Called by the weekly cron job.
 */
export async function buildAllDigests(): Promise<{
  generated: number;
  skipped: number;
  notified: number;
}> {
  const { data: agents } = await supabaseAdmin.from("agents").select("id");
  if (!agents?.length) return { generated: 0, skipped: 0, notified: 0 };

  let generated = 0;
  let skipped = 0;
  let notified = 0;

  for (const agent of agents) {
    const agentId = String((agent as { id: number }).id);
    const digest = await buildDigestForAgent(agentId);

    if (!digest) {
      skipped++;
      continue;
    }

    generated++;

    // Send push notification.
    try {
      await insertAgentInboxNotification({
        agentId,
        type: "reminder",
        priority: "medium",
        title: digest.title,
        body: digest.body,
        deepLink: { screen: "notifications" },
      });

      await supabaseAdmin
        .from("performance_digests")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", digest.id);

      notified++;
    } catch (e) {
      console.warn("buildAllDigests: push notification failed for agent", agentId, e);
    }
  }

  return { generated, skipped, notified };
}

/**
 * Get the latest digest for an agent (for dashboard display).
 */
export async function getLatestDigest(agentId: string): Promise<PerformanceDigestRow | null> {
  const { data, error } = await supabaseAdmin
    .from("performance_digests")
    .select("*")
    .eq("agent_id", agentId as unknown as number)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as PerformanceDigestRow;
}
