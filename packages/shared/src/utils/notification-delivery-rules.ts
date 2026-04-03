import type { NotificationDeliveryTiming } from "../types/lead-attention-score";
import type { NotificationPriority } from "../types/notification-priority";

/**
 * Default mapping: urgency tier → push/inbox delivery behavior.
 * High → immediate; medium → normal; low → batched (e.g. reminder digests).
 */
export function priorityToDeliveryTiming(priority: NotificationPriority): NotificationDeliveryTiming {
  if (priority === "high") return "immediate";
  if (priority === "medium") return "normal";
  return "batched";
}

/** Short labels for settings UI or docs. */
export const DELIVERY_TIMING_LABEL: Record<NotificationDeliveryTiming, string> = {
  immediate: "Send immediately",
  normal: "Send with normal priority",
  batched: "Batch / digest (low noise)",
};
