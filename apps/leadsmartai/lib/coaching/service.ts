import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  buildDripHealthInsight,
  buildPastDueCommissionInsight,
  buildResponseTimeInsight,
  buildStaleContactsInsight,
  buildUnrepliedHotLeadsInsight,
  sortInsightsBySeverity,
  type CoachingInsight,
} from "./insights";

/**
 * Server orchestrator for the coaching dashboard.
 *
 * Pulls the slim numbers each pure builder needs (counts, oldest dates,
 * past-due totals, etc.) and runs every builder. Returns the resulting
 * insights sorted by severity. Failures of individual queries degrade
 * gracefully — the missing insight is just absent from the array; the
 * dashboard still renders the rest.
 *
 * Threshold knobs are constants here so they're easy to tune without
 * touching the pure builders.
 */

const STALE_CONTACTS_THRESHOLD_DAYS = 90;
const RESPONSE_TIME_BENCHMARK_MINUTES = 5;
const HOT_LEADS_LOOKBACK_HOURS = 24;

export type CoachingDashboardData = {
  insights: CoachingInsight[];
  /** Generated-at ISO so the panel can show "fresh as of …". */
  generatedAt: string;
};

export async function getCoachingDashboard(
  agentId: string,
): Promise<CoachingDashboardData> {
  const nowMs = Date.now();
  const generatedAt = new Date(nowMs).toISOString();

  const [
    staleInput,
    responseInput,
    dripInput,
    pastDueInput,
    unrepliedInput,
  ] = await Promise.all([
    fetchStaleContacts(agentId, nowMs),
    fetchResponseTime(agentId),
    fetchDripHealth(agentId, nowMs),
    fetchPastDueCommission(agentId, nowMs),
    fetchUnrepliedHotLeads(agentId, nowMs),
  ]);

  const insights: CoachingInsight[] = [];
  const stale = buildStaleContactsInsight(staleInput);
  if (stale) insights.push(stale);

  const response = buildResponseTimeInsight(responseInput);
  if (response) insights.push(response);

  const drip = buildDripHealthInsight(dripInput);
  if (drip) insights.push(drip);

  const pastDue = buildPastDueCommissionInsight(pastDueInput);
  if (pastDue) insights.push(pastDue);

  const unreplied = buildUnrepliedHotLeadsInsight(unrepliedInput);
  if (unreplied) insights.push(unreplied);

  return {
    insights: sortInsightsBySeverity(insights),
    generatedAt,
  };
}

// ── individual data pulls ────────────────────────────────────────

async function fetchStaleContacts(agentId: string, nowMs: number) {
  const cutoffMs = nowMs - STALE_CONTACTS_THRESHOLD_DAYS * 86_400_000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  try {
    // Cohort = past_client + sphere lifecycle stages.
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("id, last_activity_at")
      .eq("agent_id", agentId)
      .in("lifecycle_stage", ["past_client", "sphere"] as never)
      .limit(2000);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ id: string; last_activity_at: string | null }>;
    const cohortSize = rows.length;
    const stale = rows.filter((r) => {
      if (!r.last_activity_at) return true; // never touched → stale
      return r.last_activity_at < cutoffIso;
    });

    let oldestDays = STALE_CONTACTS_THRESHOLD_DAYS;
    for (const r of stale) {
      const ts = r.last_activity_at ? Date.parse(r.last_activity_at) : 0;
      const days = Math.floor((nowMs - ts) / 86_400_000);
      if (days > oldestDays) oldestDays = days;
    }

    return {
      staleCount: stale.length,
      oldestDays,
      thresholdDays: STALE_CONTACTS_THRESHOLD_DAYS,
      cohortSize,
    };
  } catch (e) {
    console.warn("[coaching] fetchStaleContacts failed:", e);
    return {
      staleCount: 0,
      oldestDays: 0,
      thresholdDays: STALE_CONTACTS_THRESHOLD_DAYS,
      cohortSize: 0,
    };
  }
}

async function fetchResponseTime(agentId: string) {
  try {
    // Pull contacts created in the last 30 days that have at least one
    // outbound communication. For each, compute (firstComm - created_at)
    // in minutes, average, return.
    const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [{ data: leadRows, error: leadErr }, { data: commRows, error: commErr }] =
      await Promise.all([
        supabaseAdmin
          .from("contacts")
          .select("id, created_at")
          .eq("agent_id", agentId)
          .gte("created_at", sinceIso)
          .limit(1000),
        supabaseAdmin
          .from("communications")
          .select("contact_id, created_at")
          .eq("agent_id", agentId)
          .gte("created_at", sinceIso)
          .limit(5000),
      ]);
    if (leadErr) throw new Error(leadErr.message);
    if (commErr) throw new Error(commErr.message);

    const leads = (leadRows ?? []) as Array<{ id: string; created_at: string }>;
    const comms = (commRows ?? []) as Array<{ contact_id: string; created_at: string }>;

    // Build "first comm per contact" lookup.
    const firstByContact = new Map<string, string>();
    for (const c of comms) {
      if (!c.contact_id) continue;
      const existing = firstByContact.get(c.contact_id);
      if (!existing || c.created_at < existing) {
        firstByContact.set(c.contact_id, c.created_at);
      }
    }

    let totalMinutes = 0;
    let count = 0;
    for (const lead of leads) {
      const first = firstByContact.get(lead.id);
      if (!first) continue;
      const deltaMs = Date.parse(first) - Date.parse(lead.created_at);
      if (deltaMs <= 0) continue;
      totalMinutes += deltaMs / 60_000;
      count += 1;
    }

    return {
      avgMinutes: count > 0 ? Math.round(totalMinutes / count) : null,
      benchmarkMinutes: RESPONSE_TIME_BENCHMARK_MINUTES,
    };
  } catch (e) {
    console.warn("[coaching] fetchResponseTime failed:", e);
    return { avgMinutes: null, benchmarkMinutes: RESPONSE_TIME_BENCHMARK_MINUTES };
  }
}

async function fetchDripHealth(agentId: string, nowMs: number) {
  try {
    const sevenDaysAgoIso = new Date(nowMs - 7 * 86_400_000).toISOString();
    const [
      { count: activeCount },
      { count: exitedCount },
      { count: completedCount },
      { count: enrolledLastWeek },
    ] = await Promise.all([
      supabaseAdmin
        .from("sphere_drip_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("status", "active"),
      supabaseAdmin
        .from("sphere_drip_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("status", "exited"),
      supabaseAdmin
        .from("sphere_drip_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("status", "completed"),
      supabaseAdmin
        .from("sphere_drip_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .gte("enrolled_at", sevenDaysAgoIso),
    ]);

    return {
      activeCount: activeCount ?? 0,
      exitedCount: exitedCount ?? 0,
      completedCount: completedCount ?? 0,
      enrolledLastWeek: enrolledLastWeek ?? 0,
    };
  } catch (e) {
    console.warn("[coaching] fetchDripHealth failed:", e);
    return { activeCount: 0, exitedCount: 0, completedCount: 0, enrolledLastWeek: 0 };
  }
}

async function fetchPastDueCommission(agentId: string, nowMs: number) {
  try {
    const todayIso = new Date(nowMs).toISOString().slice(0, 10);
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("id, gross_commission, closing_date, status")
      .eq("agent_id", agentId)
      .in("status", ["active", "pending"])
      .lt("closing_date", todayIso)
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      id: string;
      gross_commission: number | string | null;
      closing_date: string | null;
    }>;

    let pastDueGross = 0;
    for (const r of rows) {
      const g =
        typeof r.gross_commission === "number"
          ? r.gross_commission
          : Number(r.gross_commission ?? 0);
      if (Number.isFinite(g)) pastDueGross += g;
    }

    return { pastDueCount: rows.length, pastDueGross };
  } catch (e) {
    console.warn("[coaching] fetchPastDueCommission failed:", e);
    return { pastDueCount: 0, pastDueGross: 0 };
  }
}

async function fetchUnrepliedHotLeads(agentId: string, nowMs: number) {
  const sinceIso = new Date(nowMs - HOT_LEADS_LOOKBACK_HOURS * 3_600_000).toISOString();
  try {
    // Pull recent hot contacts + the set of contacts the agent has
    // messaged in the same window. Count contacts in the first set
    // that aren't in the second.
    const [
      { data: leadRows, error: leadErr },
      { data: commRows, error: commErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("contacts")
        .select("id, rating")
        .eq("agent_id", agentId)
        .gte("created_at", sinceIso)
        .limit(500),
      supabaseAdmin
        .from("communications")
        .select("contact_id")
        .eq("agent_id", agentId)
        .gte("created_at", sinceIso)
        .limit(2000),
    ]);
    if (leadErr) throw new Error(leadErr.message);
    if (commErr) throw new Error(commErr.message);

    const messaged = new Set<string>();
    for (const r of (commRows ?? []) as Array<{ contact_id: string | null }>) {
      if (r.contact_id) messaged.add(r.contact_id);
    }

    const hotUnreplied = ((leadRows ?? []) as Array<{ id: string; rating: string | null }>)
      .filter((l) => String(l.rating ?? "").toLowerCase() === "hot")
      .filter((l) => !messaged.has(l.id));

    return { count: hotUnreplied.length, hours: HOT_LEADS_LOOKBACK_HOURS };
  } catch (e) {
    console.warn("[coaching] fetchUnrepliedHotLeads failed:", e);
    return { count: 0, hours: HOT_LEADS_LOOKBACK_HOURS };
  }
}
