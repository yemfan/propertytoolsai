/**
 * Shared types for AI-generated growth opportunities on /dashboard/growth.
 *
 * These types are the contract between the Claude generator, the DB
 * cache, and the UI renderer. When adding a new category or action,
 * update all three — there's no schema validation at the DB layer
 * (payload is jsonb).
 */

export type OpportunityPriority = "high" | "medium" | "low";

export type OpportunityCategory =
  | "stale_sphere"
  | "cold_hot_lead"
  | "would_offer_idle"
  | "stalled_offer"
  | "pipeline_gap"
  | "source_concentration"
  | "close_rate"
  | "anniversary_reach_out"
  | "other";

export type GrowthOpportunity = {
  /** Stable id within this generation run — lets the UI dismiss a card
      without refreshing the whole cache. */
  id: string;
  priority: OpportunityPriority;
  category: OpportunityCategory;
  /** Short sentence, action-first. "Re-engage 3 sphere contacts." */
  title: string;
  /** One-to-two sentences explaining the signal and why it matters. */
  insight: string;
  /** One-sentence imperative. "Send a check-in text to each." */
  action: string;
  /** Deep-link into the app. Relative paths only (no protocol). */
  actionUrl: string | null;
  /** Button label for the action. "Open Messages", "View contacts", etc. */
  actionLabel: string | null;
  /** Optional — up to 3 short context items (names/numbers) the card can display. */
  context: string[];
};

/**
 * Snapshot of agent state fed into the Claude prompt. All fields are
 * aggregated — we do NOT send raw contact/deal rows to Claude. Privacy
 * wise, this is the agent's own data anyway; compactness wise, this
 * lets the model reason without drowning in 500-contact lists.
 */
export type AgentGrowthSnapshot = {
  generatedAtIso: string;
  contactsTotal: number;
  contactsNoContactIn60d: number;
  contactsClosedPastClients: number;
  contactsClosedPastClientsNoAnniversary: number;

  hotLeadsNoContactIn7d: Array<{ id: string; name: string; daysSinceContact: number }>;

  showingsLovedNoOffer: Array<{
    id: string;
    propertyAddress: string;
    contactId: string;
    contactName: string | null;
    daysSinceShowing: number;
  }>;

  offersActive: number;
  offersStalled: Array<{
    id: string;
    propertyAddress: string;
    contactName: string | null;
    status: string;
    daysSinceUpdate: number;
  }>;
  offersSubmitted90d: number;
  offersAccepted90d: number;
  offersLost90d: number;

  transactionsActive: number;
  transactionsClosed90d: number;

  /** Top lead sources by count (for concentration detection). */
  topLeadSources: Array<{ source: string; count: number }>;
};
