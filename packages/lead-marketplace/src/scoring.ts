/**
 * Rules-based lead scoring (0–100). Replace `calculateLeadScore` with an AI/ML adapter later
 * without changing call sites — keep `LeadScoringInput` stable.
 */

export type LeadScoringInput = {
  /** e.g. sell | buy | refinance | invest */
  intent?: string | null;
  /** Primary tool key e.g. home_value, mortgage_calculator, affordability */
  tool_used?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Estimated property value in USD */
  property_value?: number | null;
  /** immediate | 3-6 months | exploring (or synonyms) */
  timeframe?: string | null;
  /**
   * Number of distinct tools used for this lead (from analytics).
   * 0/undefined = unknown → treat as single-tool (+5).
   */
  distinct_tools_used?: number | null;
};

export type LeadScoreBreakdown = {
  intentPoints: number;
  toolPoints: number;
  dataPoints: number;
  propertyPoints: number;
  timeframePoints: number;
  engagementPoints: number;
  total: number;
};

const MAX = {
  intent: 30,
  tool: 20,
  data: 15,
  property: 15,
  timeframe: 10,
  engagement: 10,
} as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function intentPoints(intent: string | null | undefined): number {
  const k = String(intent ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "_");
  if (k.includes("sell")) return 30;
  if (k.includes("buy")) return 25;
  if (k.includes("refin")) return 20;
  if (k.includes("invest")) return 15;
  return 0;
}

function toolPoints(tool: string | null | undefined): number {
  const t = String(tool ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!t) return 0;
  if (t.includes("home_value") || t === "homevalue") return 20;
  if (t.includes("mortgage")) return 15;
  if (t.includes("afford")) return 10;
  return 0;
}

function dataPoints(email: string | null | undefined, phone: string | null | undefined): number {
  let p = 0;
  if (String(email ?? "").trim()) p += 5;
  if (String(phone ?? "").replace(/\D/g, "").length >= 10) p += 10;
  return clamp(p, 0, MAX.data);
}

function propertyValuePoints(value: number | null | undefined): number {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (v > 1_000_000) return 15;
  if (v >= 500_000) return 10;
  return 5;
}

function timeframePoints(tf: string | null | undefined): number {
  const s = String(tf ?? "")
    .trim()
    .toLowerCase();
  if (!s) return 0;
  if (s.includes("immediate") || s.includes("now") || s.includes("asap")) return 10;
  if (s.includes("3") && s.includes("6")) return 5;
  if (s.includes("explor")) return 2;
  return 0;
}

function engagementPoints(distinctTools: number | null | undefined): number {
  const n = Number(distinctTools);
  if (!Number.isFinite(n) || n <= 0) return 5;
  if (n >= 2) return 10;
  return 5;
}

/**
 * Deterministic 0–100 score from funnel attributes + engagement.
 * Swap implementation for ML later; keep the export name.
 */
export function calculateLeadScore(lead: LeadScoringInput): number {
  const breakdown = calculateLeadScoreWithBreakdown(lead);
  return breakdown.total;
}

export function calculateLeadScoreWithBreakdown(lead: LeadScoringInput): LeadScoreBreakdown {
  const ip = clamp(intentPoints(lead.intent), 0, MAX.intent);
  const tp = clamp(toolPoints(lead.tool_used), 0, MAX.tool);
  const dp = dataPoints(lead.email, lead.phone);
  const pp = clamp(propertyValuePoints(lead.property_value), 0, MAX.property);
  const fp = clamp(timeframePoints(lead.timeframe), 0, MAX.timeframe);
  const ep = clamp(engagementPoints(lead.distinct_tools_used), 0, MAX.engagement);

  const total = clamp(ip + tp + dp + pp + fp + ep, 0, 100);

  return {
    intentPoints: ip,
    toolPoints: tp,
    dataPoints: dp,
    propertyPoints: pp,
    timeframePoints: fp,
    engagementPoints: ep,
    total,
  };
}

/** Model id for analytics / future ML versioning */
export const LEAD_SCORING_MODEL_VERSION = "rules_v1";
