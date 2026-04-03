import type {
  NotificationContextScoreInput,
  NotificationScoreResult,
} from "../types/notification-context-score";
import {
  notificationContextToLeadSignals,
  scoreLeadAttention,
} from "./lead-attention-score";

/**
 * Legacy heuristic API — delegates to {@link scoreLeadAttention} for a single source of truth.
 * Prefer `scoreLeadAttention` + {@link LeadAttentionSignals} for new code.
 */
export function scoreNotificationContext(ctx: NotificationContextScoreInput): NotificationScoreResult {
  const r = scoreLeadAttention(notificationContextToLeadSignals(ctx));
  return {
    score: r.score,
    priority: r.priority,
    reasons: r.reasons,
    contributions: r.contributions,
    deliveryTiming: r.deliveryTiming,
  };
}
