import { supabaseServer } from "@/lib/supabaseServer";
import { buildFunnelFromCounts } from "./funnel";
import { bucketDailyRevenue, buildKpiSummary } from "./kpis";
import { evaluateRules, snapshotFromKpis } from "./alerts";
import type { AlertRuleRow, DailyRevenuePoint, FunnelStep, KpiSummary } from "./types";
import { DEFAULT_FUNNEL_STEPS } from "./types";

export async function insertBusinessEvent(params: {
  agentId: string;
  eventName: string;
  sessionId?: string | null;
  properties?: Record<string, unknown>;
  revenueCents?: number | null;
}) {
  const { error } = await supabaseServer.from("agent_business_events").insert({
    agent_id: params.agentId,
    event_name: params.eventName,
    session_id: params.sessionId ?? null,
    properties: params.properties ?? {},
    revenue_cents: params.revenueCents ?? null,
  });
  if (error) throw error;
}

export async function insertRevenueTransaction(params: {
  agentId: string;
  amountCents: number;
  currency?: string;
  category?: string;
  source?: string;
  externalRef?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}) {
  const row = {
    agent_id: params.agentId,
    amount_cents: params.amountCents,
    currency: params.currency ?? "usd",
    category: params.category ?? "other",
    source: params.source ?? "manual",
    external_ref: params.externalRef ?? null,
    metadata: params.metadata ?? {},
    occurred_at: params.occurredAt ?? new Date().toISOString(),
  };

  if (params.externalRef) {
    const { data: existing } = await supabaseServer
      .from("revenue_transactions")
      .select("id")
      .eq("external_ref", params.externalRef)
      .maybeSingle();
    if (existing) return { id: (existing as { id: string }).id, duplicate: true };
  }

  const { data, error } = await supabaseServer
    .from("revenue_transactions")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return { id: (data as { id: string }).id, duplicate: false };
}

export async function ensureDefaultAlertRules(agentId: string) {
  const { data: existing, error: e1 } = await supabaseServer
    .from("kpi_alert_rules")
    .select("id")
    .eq("agent_id", agentId)
    .limit(1);
  if (e1) throw e1;
  if (existing?.length) return;

  const { error } = await supabaseServer.from("kpi_alert_rules").insert([
    {
      agent_id: agentId,
      metric_key: "revenue_cents",
      operator: "lt",
      threshold_numeric: 50_000,
      severity: "warning",
      enabled: false,
      cooldown_minutes: 1440,
    },
    {
      agent_id: agentId,
      metric_key: "conversion_rate",
      operator: "lt",
      threshold_numeric: 2,
      severity: "info",
      enabled: false,
      cooldown_minutes: 2880,
    },
    {
      agent_id: agentId,
      metric_key: "funnel_sessions",
      operator: "lt",
      threshold_numeric: 20,
      severity: "warning",
      enabled: false,
      cooldown_minutes: 1440,
    },
  ]);
  if (error) throw error;
}

async function countEventsByName(
  agentId: string,
  since: string,
  names: string[]
): Promise<Record<string, number>> {
  const { data, error } = await supabaseServer
    .from("agent_business_events")
    .select("event_name")
    .eq("agent_id", agentId)
    .gte("created_at", since)
    .in("event_name", names);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const n of names) counts[n] = 0;
  for (const row of data ?? []) {
    const n = String((row as { event_name: string }).event_name);
    counts[n] = (counts[n] ?? 0) + 1;
  }
  return counts;
}

async function countDistinctSessions(
  agentId: string,
  since: string
): Promise<number> {
  const { data, error } = await supabaseServer
    .from("agent_business_events")
    .select("session_id")
    .eq("agent_id", agentId)
    .gte("created_at", since)
    .not("session_id", "is", null);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    const sid = (row as { session_id: string | null }).session_id;
    if (sid) set.add(sid);
  }
  return set.size;
}

export async function loadRevenueDashboardData(agentId: string, windowDays: number) {
  const days = Math.max(1, Math.min(366, windowDays));
  const now = Date.now();
  const windowEnd = new Date(now);
  const windowStart = new Date(now - days * 86400000);
  const priorStart = new Date(now - days * 2 * 86400000);

  const since = windowStart.toISOString();
  const sincePrior = priorStart.toISOString();

  const { data: revRows, error: eRev } = await supabaseServer
    .from("revenue_transactions")
    .select("amount_cents,occurred_at")
    .eq("agent_id", agentId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: true });
  if (eRev) throw eRev;

  const { data: revPrior, error: eRevP } = await supabaseServer
    .from("revenue_transactions")
    .select("amount_cents")
    .eq("agent_id", agentId)
    .gte("occurred_at", sincePrior)
    .lt("occurred_at", since);
  if (eRevP) throw eRevP;

  const revenueCents = (revRows ?? []).reduce(
    (s, r) => s + Number((r as { amount_cents: number }).amount_cents),
    0
  );
  const revenueCentsPrior = (revPrior ?? []).reduce(
    (s, r) => s + Number((r as { amount_cents: number }).amount_cents),
    0
  );

  const counts = await countEventsByName(agentId, since, [...DEFAULT_FUNNEL_STEPS]);
  const pageViewEvents = counts["funnel_page_view"] ?? 0;
  const purchaseEvents = counts["funnel_purchase"] ?? 0;
  const leadEvents = counts["funnel_lead_submit"] ?? 0;
  const funnelSessions = await countDistinctSessions(agentId, since);

  const kpi: KpiSummary = buildKpiSummary({
    windowDays: days,
    revenueCents,
    revenueCentsPrior,
    transactionCount: revRows?.length ?? 0,
    funnelSessions,
    leadEvents,
    pageViewEvents,
    purchaseEvents,
  });

  const series: DailyRevenuePoint[] = bucketDailyRevenue(
    (revRows ?? []) as { occurred_at: string; amount_cents: number }[],
    windowStart,
    windowEnd
  );

  const funnel: FunnelStep[] = buildFunnelFromCounts(counts, DEFAULT_FUNNEL_STEPS);

  await ensureDefaultAlertRules(agentId);

  const { data: rulesRaw, error: eRules } = await supabaseServer
    .from("kpi_alert_rules")
    .select(
      "id,agent_id,metric_key,operator,threshold_numeric,severity,enabled,cooldown_minutes,last_triggered_at"
    )
    .eq("agent_id", agentId);
  if (eRules) throw eRules;

  const rules = (rulesRaw ?? []) as unknown as AlertRuleRow[];

  const { data: alertsFeed, error: eAlert } = await supabaseServer
    .from("kpi_alert_events")
    .select("id,message,observed_value,created_at,rule_id")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (eAlert) throw eAlert;

  return {
    kpi,
    series,
    funnel,
    rules,
    alertsFeed: alertsFeed ?? [],
  };
}

/** Run threshold checks and emit kpi_alert_events (call from POST / cron, not every GET). */
export async function evaluateAndEmitAlerts(agentId: string, windowDays: number) {
  const data = await loadRevenueDashboardData(agentId, windowDays);
  const snap = snapshotFromKpis(data.kpi, data.kpi.funnelSessions);
  const triggers = evaluateRules(data.rules, snap, new Date());

  for (const t of triggers) {
    await supabaseServer.from("kpi_alert_events").insert({
      agent_id: agentId,
      rule_id: t.rule.id,
      message: t.message,
      observed_value: t.observed,
    });
    await supabaseServer
      .from("kpi_alert_rules")
      .update({ last_triggered_at: new Date().toISOString() })
      .eq("id", t.rule.id);
  }

  return { triggers, count: triggers.length };
}
