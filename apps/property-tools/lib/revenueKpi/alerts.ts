import type { AlertOperator, KpiSummary } from "./types";
import type { AlertRuleRow } from "./types";

function compare(op: AlertOperator, observed: number, threshold: number): boolean {
  switch (op) {
    case "lt":
      return observed < threshold;
    case "lte":
      return observed <= threshold;
    case "gt":
      return observed > threshold;
    case "gte":
      return observed >= threshold;
    case "eq":
      return observed === threshold;
    default:
      return false;
  }
}

export type MetricSnapshot = {
  revenue_cents: number;
  conversion_rate: number | null;
  funnel_sessions: number;
  avg_deal_cents: number | null;
};

export function snapshotFromKpis(k: KpiSummary, funnelSessions: number): MetricSnapshot {
  return {
    revenue_cents: k.revenueCents,
    conversion_rate: k.funnelConversionPct,
    funnel_sessions: funnelSessions,
    avg_deal_cents: k.avgDealCents,
  };
}

function metricValue(key: string, snap: MetricSnapshot): number | null {
  switch (key) {
    case "revenue_cents":
      return snap.revenue_cents;
    case "conversion_rate":
      return snap.conversion_rate;
    case "funnel_sessions":
      return snap.funnel_sessions;
    case "avg_deal_cents":
      return snap.avg_deal_cents;
    default:
      return null;
  }
}

export type TriggerResult = {
  rule: AlertRuleRow;
  observed: number;
  message: string;
};

export function evaluateRules(
  rules: AlertRuleRow[],
  snap: MetricSnapshot,
  now: Date
): TriggerResult[] {
  const out: TriggerResult[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const observed = metricValue(rule.metric_key, snap);
    if (observed === null || observed === undefined) continue;

    const threshold = Number(rule.threshold_numeric);
    if (!compare(rule.operator as AlertOperator, observed, threshold)) continue;

    if (rule.last_triggered_at) {
      const last = new Date(rule.last_triggered_at).getTime();
      const cool = rule.cooldown_minutes * 60 * 1000;
      if (now.getTime() - last < cool) continue;
    }

    const label = rule.metric_key.replace(/_/g, " ");
    out.push({
      rule,
      observed,
      message: `${label} ${rule.operator} ${threshold}: observed ${observed}`,
    });
  }

  return out;
}
