/**
 * Canonical `usage_events.event_type` values (append-only; add new names here + docs).
 */
export const USAGE_EVENT_TYPES = {
  AI_DRAFT_CONSUMED: "ai_draft_consumed",
  DEAL_ASSISTANT_ANALYZE: "deal_assistant_analyze",
} as const;

/**
 * Canonical `subscription_events.event_type` values written by the product + Stripe sync.
 */
export const SUBSCRIPTION_EVENT_TYPES = {
  /** Stripe webhook / sync: paying row changed (active/trialing MRR or amount/plan change). */
  BILLING_UPDATED: "billing_updated",
  /** Non-paying terminal-ish state from Stripe sync (canceled, incomplete, past_due, etc.). */
  BILLING_INACTIVE: "billing_inactive",
  /** Explicit cancel (subscription.deleted or sync transition to canceled). */
  SUBSCRIPTION_CANCELED: "subscription_canceled",
  /** CRM mirror row became active (non-Stripe or secondary source). */
  CRM_SUBSCRIPTION_ACTIVE: "crm_subscription_active",
} as const;
