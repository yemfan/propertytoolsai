export type RevenueCategory =
  | "subscription"
  | "one_time"
  | "lead"
  | "marketplace"
  | "other";

export type RevenueSource = "stripe" | "manual" | "api";

export type AlertOperator = "lt" | "gt" | "lte" | "gte" | "eq";

export type AlertSeverity = "info" | "warning" | "critical";

/** Default funnel — override per product by tracking these event_name values */
export const DEFAULT_FUNNEL_STEPS = [
  "funnel_page_view",
  "funnel_tool_open",
  "funnel_lead_submit",
  "funnel_booking",
  "funnel_purchase",
] as const;

export type KpiSummary = {
  windowDays: number;
  revenueCents: number;
  revenueCentsPrior: number;
  revenueMomPct: number | null;
  transactionCount: number;
  avgDealCents: number | null;
  /** Unique sessions with at least one funnel event */
  funnelSessions: number;
  /** Lead-ish events in window */
  leadEvents: number;
  /** Estimated conversion: purchases / page views (if both > 0) */
  funnelConversionPct: number | null;
};

export type FunnelStep = {
  step: string;
  count: number;
  pctOfFirst: number;
  dropOffPct: number | null;
};

export type DailyRevenuePoint = {
  day: string;
  revenueCents: number;
  transactions: number;
};

export type AlertRuleRow = {
  id: string;
  agent_id: string;
  metric_key: string;
  operator: AlertOperator;
  threshold_numeric: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
};

/** Stored in kpi_alert_rules.metric_key */
export type MetricKey =
  | "revenue_cents"
  | "conversion_rate"
  | "funnel_sessions"
  | "avg_deal_cents";
