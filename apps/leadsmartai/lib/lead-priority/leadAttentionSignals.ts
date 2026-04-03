import type { LeadAttentionSignals } from "@leadsmart/shared";
import type { MobileDashboardAlertType } from "@leadsmart/shared";

/** Optional row slice from `public.leads` for attention scoring. */
export type LeadAttentionRow = {
  rating?: string | null;
  prediction_score?: number | null;
  prediction_label?: string | null;
  ai_timeline?: string | null;
};

export function parseTimelineUrgency(aiTimeline: string | null | undefined): boolean {
  if (!aiTimeline || typeof aiTimeline !== "string") return false;
  return /\b(asap|urgent|within\s*48|48\s*hr|this week|few days|closing soon|list(ing)?\s+soon)\b/i.test(
    aiTimeline
  );
}

export function leadRowToBaseSignals(row: LeadAttentionRow | null | undefined): LeadAttentionSignals {
  if (!row) return {};
  const hot = String(row.rating ?? "")
    .toLowerCase()
    .trim() === "hot";
  const ps = row.prediction_score;
  return {
    hotLead: hot,
    dealPredictionScore: ps != null && !Number.isNaN(Number(ps)) ? Number(ps) : null,
    dealPredictionLabel: row.prediction_label as LeadAttentionSignals["dealPredictionLabel"],
    sellerTimelineUrgent: parseTimelineUrgency(row.ai_timeline ?? null),
  };
}

/**
 * Overlay dashboard alert type onto CRM-derived signals (same lead may appear in multiple alerts).
 */
export function overlayDashboardAlertSignals(
  base: LeadAttentionSignals,
  type: MobileDashboardAlertType
): LeadAttentionSignals {
  const next: LeadAttentionSignals = { ...base };
  if (type === "overdue_task") next.overdueTask = true;
  if (type === "ai_escalation") next.needsHuman = true;
  if (type === "unread_message") next.unreadInboundMessage = true;
  if (type === "hot_lead") next.hotLead = true;
  return next;
}
