import type {
  LeadAttentionScoreContribution,
  LeadAttentionScoreResult,
  LeadAttentionSignals,
  LeadAttentionThresholds,
  NotificationDeliveryTiming,
} from "../types/lead-attention-score";
import type { NotificationPriority } from "../types/notification-priority";
import { priorityToDeliveryTiming } from "./notification-delivery-rules";

/** Transparent default weights — adjust in one place; reasons stay human-readable. */
export const LEAD_ATTENTION_WEIGHTS = {
  urgentCallbackRequested: 36,
  needsHuman: 28,
  hotLead: 24,
  missedCall: 20,
  predictionHigh: 22,
  predictionMedium: 12,
  predictionLow: 4,
  overdueTask: 16,
  unreadInbound: 12,
  unreadInboundExtra: 5,
  showingSoon: 18,
  sellerTimelineUrgent: 18,
  responseRiskElevated: 10,
} as const;

export const DEFAULT_LEAD_ATTENTION_THRESHOLDS: LeadAttentionThresholds = {
  highMin: 72,
  mediumMin: 42,
};

const SCORE_CAP = 100;

function predictionTier(score: number | null | undefined): {
  label: string;
  points: number;
  key: string;
} | null {
  if (score == null || Number.isNaN(Number(score))) return null;
  const s = Math.max(0, Math.min(100, Number(score)));
  if (s >= 70) {
    return {
      key: "prediction_high",
      points: LEAD_ATTENTION_WEIGHTS.predictionHigh,
      label: `Strong deal prediction (${Math.round(s)}/100)`,
    };
  }
  if (s >= 45) {
    return {
      key: "prediction_medium",
      points: LEAD_ATTENTION_WEIGHTS.predictionMedium,
      label: `Moderate deal prediction (${Math.round(s)}/100)`,
    };
  }
  return {
    key: "prediction_low",
    points: LEAD_ATTENTION_WEIGHTS.predictionLow,
    label: `Deal prediction on file (${Math.round(s)}/100)`,
  };
}

function pushContribution(
  list: LeadAttentionScoreContribution[],
  key: string,
  points: number,
  reason: string
) {
  if (points <= 0) return;
  list.push({ key, points, reason });
}

/**
 * Explainable, additive heuristic — no ML black box. Each signal maps to a named contribution.
 */
export function scoreLeadAttention(
  signals: LeadAttentionSignals,
  thresholds: LeadAttentionThresholds = DEFAULT_LEAD_ATTENTION_THRESHOLDS
): LeadAttentionScoreResult {
  const contributions: LeadAttentionScoreContribution[] = [];

  if (signals.urgentCallbackRequested) {
    pushContribution(
      contributions,
      "urgent_callback",
      LEAD_ATTENTION_WEIGHTS.urgentCallbackRequested,
      "Urgent callback or follow-up requested"
    );
  }

  if (signals.needsHuman) {
    pushContribution(
      contributions,
      "needs_human",
      LEAD_ATTENTION_WEIGHTS.needsHuman,
      "Needs human review (AI or policy escalation)"
    );
  }

  if (signals.hotLead) {
    pushContribution(contributions, "hot_lead", LEAD_ATTENTION_WEIGHTS.hotLead, "Lead marked hot");
  }

  if (signals.missedCall) {
    pushContribution(
      contributions,
      "missed_call",
      LEAD_ATTENTION_WEIGHTS.missedCall,
      "Missed inbound call"
    );
  }

  const pred = predictionTier(signals.dealPredictionScore);
  if (pred) {
    const explain =
      signals.dealPredictionLabel != null
        ? `Deal prediction: ${signals.dealPredictionLabel} (${Math.round(
            Number(signals.dealPredictionScore ?? 0)
          )}/100)`
        : pred.label;
    pushContribution(contributions, pred.key, pred.points, explain);
  }

  if (signals.overdueTask) {
    pushContribution(contributions, "overdue_task", LEAD_ATTENTION_WEIGHTS.overdueTask, "Overdue task");
  }

  if (signals.unreadInboundMessage) {
    pushContribution(
      contributions,
      "unread_inbound",
      LEAD_ATTENTION_WEIGHTS.unreadInbound,
      "Unread inbound message"
    );
  }

  const unreadCount = Math.max(0, signals.unreadInboundThreadCount ?? 0);
  if (unreadCount > 1) {
    pushContribution(
      contributions,
      "unread_multi",
      LEAD_ATTENTION_WEIGHTS.unreadInboundExtra,
      `${unreadCount} threads waiting for a reply`
    );
  }

  if (signals.showingScheduledSoon) {
    pushContribution(
      contributions,
      "showing_soon",
      LEAD_ATTENTION_WEIGHTS.showingSoon,
      "Showing or tour scheduled soon"
    );
  }

  if (signals.sellerTimelineUrgent) {
    pushContribution(
      contributions,
      "seller_timeline",
      LEAD_ATTENTION_WEIGHTS.sellerTimelineUrgent,
      "Seller timeline milestone is urgent"
    );
  }

  if (signals.responseRiskElevated) {
    pushContribution(
      contributions,
      "response_risk",
      LEAD_ATTENTION_WEIGHTS.responseRiskElevated,
      "Elevated response risk if delayed"
    );
  }

  let score = contributions.reduce((s, c) => s + c.points, 0);
  score = Math.min(SCORE_CAP, Math.round(score));

  let priority: NotificationPriority = "low";
  if (score >= thresholds.highMin) priority = "high";
  else if (score >= thresholds.mediumMin) priority = "medium";

  const reasons = contributions.map((c) => c.reason);
  const deliveryTiming: NotificationDeliveryTiming = priorityToDeliveryTiming(priority);

  return {
    score,
    priority,
    reasons,
    contributions,
    deliveryTiming,
  };
}

/** Map legacy notification context fields to the richer signal shape. */
export function notificationContextToLeadSignals(ctx: {
  urgentCallbackRequested?: boolean;
  hotLead?: boolean;
  missedCall?: boolean;
  predictionScore?: number | null;
  needsHuman?: boolean;
  overdueTask?: boolean;
  unreadInboundMessage?: boolean;
}): LeadAttentionSignals {
  return {
    urgentCallbackRequested: ctx.urgentCallbackRequested,
    hotLead: ctx.hotLead,
    missedCall: ctx.missedCall,
    dealPredictionScore: ctx.predictionScore ?? null,
    needsHuman: ctx.needsHuman,
    overdueTask: ctx.overdueTask,
    unreadInboundMessage: ctx.unreadInboundMessage,
  };
}
