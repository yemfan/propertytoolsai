import type { DealPredictionLabel } from "./deal-prediction";
import type { NotificationPriority } from "./notification-priority";

/**
 * When to deliver a push / surface an item (maps from priority by default; override per channel in services).
 * - **immediate** — hot path (e.g. hot lead push)
 * - **normal** — standard queue (missed call, medium urgency)
 * - **batched** — digest / low-noise (reminders, low urgency)
 */
export type NotificationDeliveryTiming = "immediate" | "normal" | "batched";

/** One additive, explainable line item in the score. */
export type LeadAttentionScoreContribution = {
  /** Stable id for analytics / tests, e.g. `hot_lead`, `prediction_high`. */
  key: string;
  points: number;
  /** Human-readable explanation shown in UI or logs. */
  reason: string;
};

/**
 * All inputs are optional; missing values are treated as false / null / 0.
 * Add new fields here as you wire more CRM signals — keep scoring in `scoreLeadAttention` modular.
 */
export type LeadAttentionSignals = {
  /** Lead marked hot (rating or nurture). */
  hotLead?: boolean;
  /** Deal prediction 0–100 from `leads.prediction_score` (or equivalent). */
  dealPredictionScore?: number | null;
  /** Optional cached label for explainability. */
  dealPredictionLabel?: DealPredictionLabel | null;
  missedCall?: boolean;
  /** Any unread inbound SMS/email thread. */
  unreadInboundMessage?: boolean;
  /** Count of threads with inbound waiting (adds a small bump when > 1). */
  unreadInboundThreadCount?: number;
  overdueTask?: boolean;
  /** AI or rules escalated to human. */
  needsHuman?: boolean;
  /** Voice/SMS/email asked for callback ASAP. */
  urgentCallbackRequested?: boolean;
  /** Showing or tour scheduled within the “soon” window (heuristic set server-side). */
  showingScheduledSoon?: boolean;
  /** Seller listing / contract milestone feels urgent (heuristic from timeline copy or tags). */
  sellerTimelineUrgent?: boolean;
  /** Elevated risk of losing the lead if not answered (e.g. competitor, firm deadline). */
  responseRiskElevated?: boolean;
};

export type LeadAttentionScoreResult = {
  /** Sum of contribution points (capped). */
  score: number;
  priority: NotificationPriority;
  /** Flat list of reasons (from contributions). */
  reasons: string[];
  contributions: LeadAttentionScoreContribution[];
  deliveryTiming: NotificationDeliveryTiming;
};

/** Tunable thresholds (documented defaults; not a black box). */
export type LeadAttentionThresholds = {
  /** Score at or above → high priority. */
  highMin: number;
  /** Score at or above → medium (below highMin). */
  mediumMin: number;
};
