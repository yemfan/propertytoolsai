import type { LeadTemperature } from "./types";

export type LeadScoreInput = {
  source?: string | null;
  intent?: string | null;
  price?: number | null;
  last_activity_at?: string | null;
};

export type UnifiedActivityEvent = {
  event_type?: string | null;
  created_at?: string | null;
};

/**
 * Computes a 0–100 score from lead attributes + CRM/engagement activity.
 * - `activity`: merged `lead_activity_events` + `lead_events` rows (event_type + created_at).
 * - `inboundMessageCount`: count of inbound rows in `lead_conversations` (lead messages).
 */
export function calculateLeadScore(
  lead: LeadScoreInput,
  activity: UnifiedActivityEvent[],
  inboundMessageCount: number
): number {
  let score = 0;

  switch (String(lead.source ?? "")) {
    case "smart_property_match":
      score += 40;
      break;
    case "listing_inquiry":
      score += 35;
      break;
    case "affordability_report":
    case "affordability_lender_match":
      score += 25;
      break;
    case "home_value_estimate":
      score += 20;
      break;
    default:
      score += 10;
  }

  const messageSignals =
    inboundMessageCount +
    activity.filter((a) => {
      const t = String(a.event_type ?? "");
      return t === "message_received" || t === "sms_reply" || t === "reply";
    }).length;
  score += messageSignals * 10;

  const opens = activity.filter((a) => String(a.event_type ?? "") === "email_open").length;
  score += Math.min(opens * 2, 10);

  const recencySource =
    lead.last_activity_at ? new Date(lead.last_activity_at).getTime() : null;
  if (recencySource != null && Number.isFinite(recencySource)) {
    const hours = (Date.now() - recencySource) / 3600000;
    if (hours < 1) score += 20;
    else if (hours < 24) score += 10;
    else if (hours < 72) score += 5;
  }

  const intent = String(lead.intent ?? "").toLowerCase();
  if (intent === "tour_request") score += 25;
  if (intent === "smart_match") score += 15;

  const price = typeof lead.price === "number" ? lead.price : null;
  if (price != null && price > 800_000) score += 10;

  return Math.min(score, 100);
}

export function getLeadTemperature(score: number): LeadTemperature {
  if (score >= 80) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}
