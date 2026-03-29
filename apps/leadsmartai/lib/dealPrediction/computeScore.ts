import type { DealPredictionFactor, DealPredictionLabel, DealPredictionResult } from "@leadsmart/shared";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 90;

/** Inputs gathered server-side; all optional fields degrade gracefully. */
export type DealPredictionInput = {
  engagementScore: number;
  /** SMS / email rows in the last {@link WINDOW_DAYS} days */
  smsInbound90d: number;
  smsOutbound90d: number;
  emailInbound90d: number;
  emailOutbound90d: number;
  /** `lead_events` rows in the last window */
  leadEvents90d: number;
  lastActivityAt: string | null;
  lastContactedAt: string | null;
  propertyValue: number | null;
  estimatedHomeValue: number | null;
  /** ISO date string (YYYY-MM-DD) */
  homePurchaseDate: string | null;
  source: string | null;
  rating: string | null;
  intent: string | null;
  timeframe: string | null;
  nurtureScore: number | null;
  /** Latest AI layer score from `lead_scores`, 0–100 */
  aiLeadScore: number | null;
  createdAt: string | null;
};

export const DEAL_PREDICTION_WINDOW_DAYS = WINDOW_DAYS;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function roundScore(n: number): number {
  return clamp(Math.round(n), 0, 100);
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / DAY_MS;
}

function labelForScore(score: number): DealPredictionLabel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function scoreEngagement(engagementScore: number): { earned: number; detail: string } {
  const max = 18;
  const normalized = clamp(engagementScore, 0, 200);
  const earned = clamp(Math.round((normalized / 100) * max), 0, max);
  return {
    earned,
    detail: `Engagement index ${Math.round(normalized)} maps to ${earned}/${max} pts (email opens, clicks, report views, etc.).`,
  };
}

function scoreChannelActivity(input: DealPredictionInput): { earned: number; detail: string } {
  const max = 22;
  const inbound = input.smsInbound90d + input.emailInbound90d;
  const outbound = input.smsOutbound90d + input.emailOutbound90d;
  const events = clamp(input.leadEvents90d, 0, 40);
  const raw = inbound * 3 + outbound * 1 + Math.min(events, 12) * 0.5;
  const earned = clamp(Math.round(Math.min(max, raw)), 0, max);
  return {
    earned,
    detail: `Last ${WINDOW_DAYS}d: ${inbound} inbound + ${outbound} outbound messages, ${input.leadEvents90d} engagement events → ${earned}/${max} pts.`,
  };
}

function scoreRecency(input: DealPredictionInput): { earned: number; detail: string } {
  const max = 18;
  const act = daysSince(input.lastActivityAt);
  const contacted = daysSince(input.lastContactedAt);
  const best =
    act != null && contacted != null
      ? Math.min(act, contacted)
      : act ?? contacted ?? null;

  let earned = 0;
  let detail = "No recent activity timestamp; treat as cold.";
  if (best != null) {
    if (best <= 3) {
      earned = max;
      detail = `Last touch ≈ ${best.toFixed(0)}d ago — very fresh.`;
    } else if (best <= 14) {
      earned = 14;
      detail = `Last touch ≈ ${best.toFixed(0)}d ago — active thread.`;
    } else if (best <= 30) {
      earned = 10;
      detail = `Last touch ≈ ${best.toFixed(0)}d ago — moderate recency.`;
    } else if (best <= 60) {
      earned = 6;
      detail = `Last touch ≈ ${best.toFixed(0)}d ago — cooling.`;
    } else if (best <= 120) {
      earned = 3;
      detail = `Last touch ≈ ${best.toFixed(0)}d ago — stale.`;
    } else {
      earned = 0;
      detail = `Last touch ≈ ${best.toFixed(0)}d ago — long inactive.`;
    }
  }
  return { earned: clamp(earned, 0, max), detail };
}

function scorePropertySignal(pv: number | null, ehv: number | null): { earned: number; detail: string } {
  const max = 12;
  if (pv != null && pv > 0 && ehv != null && ehv > 0) {
    const delta = (ehv - pv) / pv;
    if (delta >= 0.02) {
      return {
        earned: max,
        detail: `Estimated value ${((delta * 100).toFixed(1))}% above recorded property value — equity / motivation signal.`,
      };
    }
    if (delta > 0) {
      return { earned: 9, detail: "Estimated value slightly above recorded value." };
    }
    if (delta >= -0.02) {
      return { earned: 6, detail: "Values roughly aligned — neutral equity signal." };
    }
    return { earned: 3, detail: "Estimated value below recorded value — possible distress or data drift." };
  }
  if ((pv != null && pv > 0) || (ehv != null && ehv > 0)) {
    return { earned: 4, detail: "Partial value data — small positive signal." };
  }
  return { earned: 0, detail: "No property value pair to compare." };
}

function scoreOwnership(homePurchaseDate: string | null): { earned: number; detail: string } {
  const max = 10;
  if (!homePurchaseDate) {
    return { earned: 3, detail: "Ownership length unknown — neutral baseline." };
  }
  const t = new Date(homePurchaseDate).getTime();
  if (Number.isNaN(t)) {
    return { earned: 3, detail: "Invalid purchase date — neutral baseline." };
  }
  const years = (Date.now() - t) / (365.25 * DAY_MS);
  if (years >= 3 && years <= 10) {
    return { earned: max, detail: `~${years.toFixed(1)}y ownership — common move window.` };
  }
  if ((years >= 1 && years < 3) || (years > 10 && years <= 15)) {
    return { earned: 7, detail: `~${years.toFixed(1)}y ownership — moderate fit.` };
  }
  if (years < 1) {
    return { earned: 4, detail: `~${years.toFixed(1)}y ownership — recently acquired.` };
  }
  return { earned: 5, detail: `~${years.toFixed(1)}y ownership — longer tenure.` };
}

function scoreSource(source: string | null): { earned: number; detail: string } {
  const max = 8;
  const s = (source || "").toLowerCase();
  if (!s) {
    return { earned: 3, detail: "Source unknown — low prior." };
  }
  if (/refer|repeat|past|client|friend|family/.test(s)) {
    return { earned: max, detail: `Source “${source}” — high-trust channel.` };
  }
  if (/web|site|direct|organic|seo|search/.test(s)) {
    return { earned: 6, detail: `Source “${source}” — inbound intent.` };
  }
  if (/zillow|realtor|redfin|portal|mls|facebook|meta|instagram|social/.test(s)) {
    return { earned: 5, detail: `Source “${source}” — marketplace / social.` };
  }
  return { earned: 4, detail: `Source “${source}” — default prior.` };
}

function scoreBehavior(input: DealPredictionInput): { earned: number; detail: string } {
  const max = 12;
  let pts = 0;
  const parts: string[] = [];
  const r = (input.rating || "").toLowerCase();
  if (r === "hot") {
    pts += 6;
    parts.push("rating hot (+6)");
  } else if (r === "warm") {
    pts += 4;
    parts.push("rating warm (+4)");
  } else if (r === "cold") {
    pts += 1;
    parts.push("rating cold (+1)");
  } else {
    pts += 2;
    parts.push("rating unset (+2)");
  }

  const intent = `${input.intent || ""} ${input.timeframe || ""}`.toLowerCase();
  if (/buy|sell|list|move|soon|urgent|asap|months?/.test(intent)) {
    pts += 4;
    parts.push("intent/timeframe suggests near-term action (+4)");
  }

  const ns = input.nurtureScore != null ? clamp(input.nurtureScore, 0, 100) : 0;
  const nPts = clamp(Math.round(ns / 25), 0, 4);
  pts += nPts;
  if (nPts) parts.push(`nurture activity (+${nPts})`);

  const ai = input.aiLeadScore != null ? clamp(input.aiLeadScore, 0, 100) : null;
  if (ai != null && ai >= 50) {
    const aiPts = clamp(Math.round((ai - 50) / 12.5), 0, 4);
    pts += aiPts;
    if (aiPts) parts.push(`AI intent score corroboration (+${aiPts})`);
  }

  const earned = clamp(Math.round(pts), 0, max);
  return {
    earned,
    detail: parts.length ? parts.join("; ") : "Limited behavior signals.",
  };
}

/**
 * Rules-based deal likelihood (not a black box). Each factor lists points earned vs cap and a plain-English reason.
 */
export function computeDealPrediction(input: DealPredictionInput): DealPredictionResult {
  const factors: DealPredictionFactor[] = [];

  const eng = scoreEngagement(input.engagementScore);
  factors.push({
    id: "engagement_history",
    label: "Engagement history",
    pointsEarned: eng.earned,
    pointsMax: 18,
    detail: eng.detail,
  });

  const ch = scoreChannelActivity(input);
  factors.push({
    id: "sms_email_activity",
    label: "SMS & email activity",
    pointsEarned: ch.earned,
    pointsMax: 22,
    detail: ch.detail,
  });

  const rec = scoreRecency(input);
  factors.push({
    id: "recency",
    label: "Last contact / activity",
    pointsEarned: rec.earned,
    pointsMax: 18,
    detail: rec.detail,
  });

  const prop = scorePropertySignal(input.propertyValue, input.estimatedHomeValue);
  factors.push({
    id: "property_value_signal",
    label: "Property value signal",
    pointsEarned: prop.earned,
    pointsMax: 12,
    detail: prop.detail,
  });

  const own = scoreOwnership(input.homePurchaseDate);
  factors.push({
    id: "ownership_duration",
    label: "Ownership duration",
    pointsEarned: own.earned,
    pointsMax: 10,
    detail: own.detail,
  });

  const src = scoreSource(input.source);
  factors.push({
    id: "lead_source",
    label: "Lead source",
    pointsEarned: src.earned,
    pointsMax: 8,
    detail: src.detail,
  });

  const beh = scoreBehavior(input);
  factors.push({
    id: "lead_behavior",
    label: "Lead behavior & AI corroboration",
    pointsEarned: beh.earned,
    pointsMax: 12,
    detail: beh.detail,
  });

  const rawTotal = factors.reduce((s, f) => s + f.pointsEarned, 0);
  const score = roundScore(rawTotal);
  const label = labelForScore(score);

  return { score, label, factors };
}
