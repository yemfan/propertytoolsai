import type {
  LeadAttentionScoreContribution,
  NotificationDeliveryTiming,
} from "./lead-attention-score";
import type { NotificationPriority } from "./notification-priority";

export type { NotificationPriority };

export type NotificationScoreResult = {
  score: number;
  priority: NotificationPriority;
  reasons: string[];
  /** Present when computed via {@link scoreLeadAttention} / {@link scoreNotificationContext}. */
  contributions?: LeadAttentionScoreContribution[];
  deliveryTiming?: NotificationDeliveryTiming;
};

/** Inputs for heuristic notification importance (all optional; missing = false / 0). */
export type NotificationContextScoreInput = {
  urgentCallbackRequested?: boolean;
  hotLead?: boolean;
  missedCall?: boolean;
  /** Model or rules-based conversion score, e.g. 0–100. */
  predictionScore?: number | null;
  needsHuman?: boolean;
  overdueTask?: boolean;
  unreadInboundMessage?: boolean;
};
