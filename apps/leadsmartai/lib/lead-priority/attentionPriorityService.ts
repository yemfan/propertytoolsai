import {
  priorityToDeliveryTiming,
  scoreLeadAttention,
  type LeadAttentionSignals,
  type LeadAttentionScoreResult,
} from "@leadsmart/shared";

/**
 * Single entry for “how should we treat this lead/event?” — scoring + delivery timing.
 * Use from push pipelines, cron, or API when you need explainable priority.
 */
export function evaluateLeadAttention(signals: LeadAttentionSignals): LeadAttentionScoreResult {
  return scoreLeadAttention(signals);
}

export function deliveryTimingForPriority(
  priority: LeadAttentionScoreResult["priority"]
): ReturnType<typeof priorityToDeliveryTiming> {
  return priorityToDeliveryTiming(priority);
}
