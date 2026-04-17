/**
 * Per-agent message delivery policy, timing rules, and compliance flags.
 * Surfaced in the Dashboard Settings "Messages" and "Channels & Compliance" tabs.
 */

export type ReviewPolicy = "review" | "autosend" | "per_category";

export type ReviewPolicyByCategory = {
  /** Past-client outreach (anniversaries, equity, dormant). */
  sphere: "review" | "autosend";
  /** New lead responses (first-touch, no-reply, tour confirmations). */
  lead_response: "review" | "autosend";
};

export const DEFAULT_REVIEW_POLICY_BY_CATEGORY: ReviewPolicyByCategory = {
  sphere: "review",
  lead_response: "review",
};

export type AgentMessageSettings = {
  reviewPolicy: ReviewPolicy;
  reviewPolicyByCategory: ReviewPolicyByCategory;
  quietHoursStart: string; // HH:MM
  quietHoursEnd: string; // HH:MM
  useContactTimezone: boolean;
  noSundayMorning: boolean;
  pauseChineseNewYear: boolean;
  maxPerContactPerDay: number; // 1..5
  pauseOnReplyDays: number; // 0..30
};

export type AgentMessageSettingsEffective = AgentMessageSettings & {
  /** After §2.4 30-day onboarding gate — use this for trigger scheduling, never the raw policy. */
  effectiveReviewPolicy: ReviewPolicy;
  effectiveReviewPolicyByCategory: ReviewPolicyByCategory;
  onboardingGateActive: boolean;
  agentCreatedAt: string | null;
};

export type AgentMessageSettingsRow = {
  id: string;
  agent_id: string;
  review_policy: ReviewPolicy;
  review_policy_by_category: ReviewPolicyByCategory;
  quiet_hours_start: string;
  quiet_hours_end: string;
  use_contact_timezone: boolean;
  no_sunday_morning: boolean;
  pause_chinese_new_year: boolean;
  max_per_contact_per_day: number;
  pause_on_reply_days: number;
  created_at: string;
  updated_at: string;
};

export type AgentMessageSettingsEffectiveRow = {
  id: string;
  agent_id: string;
  effective_review_policy: ReviewPolicy;
  effective_review_policy_by_category: ReviewPolicyByCategory;
  stored_review_policy: ReviewPolicy;
  stored_review_policy_by_category: ReviewPolicyByCategory;
  onboarding_gate_active: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  use_contact_timezone: boolean;
  no_sunday_morning: boolean;
  pause_chinese_new_year: boolean;
  max_per_contact_per_day: number;
  pause_on_reply_days: number;
  agent_created_at: string | null;
  updated_at: string;
};
