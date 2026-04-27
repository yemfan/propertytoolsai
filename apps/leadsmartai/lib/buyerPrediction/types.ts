import type { ContactSignalType } from "@/lib/contacts/types";

/**
 * Likely-buyer prediction is the dual of `lib/spherePrediction` (seller side).
 *
 *   spherePrediction: "Will this past client list their CURRENT home?"
 *   buyerPrediction:  "Will this past client / sphere contact buy their
 *                      NEXT home in ~90 days?"
 *
 * Same cohort (past_client + sphere) but different signal weights:
 *
 *   Strongest buyer-only signals (drive scores up):
 *     - job_change      → relocation, must-buy
 *     - life_event_other → marriage / kids / divorce / retirement → upgrade or downsize
 *     - equity_milestone → could now afford to upgrade
 *
 *   Mid signals (dual / repurposed):
 *     - refi_detected   → cash-out refi often precedes moving up
 *     - tenure          → ~5-9y window applies (sell-then-buy concurrently)
 *
 *   Negative for buyer-prediction (these are seller-only):
 *     - listing_activity → neighbors selling = local seller signal,
 *                         not buyer signal. Ignored here.
 *
 * Lives in its own module so weights + signal handling can evolve without
 * affecting the seller side — they share a cohort but diverge on logic.
 */

export type BuyerPredictionLabel = "high" | "medium" | "low";

export type BuyerPredictionFactor = {
  /** Stable id for analytics + UI. Don't rename. */
  id:
    | "tenure"
    | "buyer_intent_signals"
    | "equity_to_upgrade"
    | "engagement_uptick"
    | "anniversary_dormancy";
  label: string;
  pointsEarned: number;
  pointsMax: number;
  /** Plain-English rationale. */
  detail: string;
};

export type BuyerPredictionScoreResult = {
  /** 0–100 capped. */
  score: number;
  label: BuyerPredictionLabel;
  factors: BuyerPredictionFactor[];
};

/**
 * Inputs assembled server-side. All optional — partial data degrades the
 * score (lower / less confident) rather than throwing.
 */
export type BuyerPredictionInput = {
  /** ISO date when the contact bought their CURRENT home. */
  homePurchaseDate: string | null;
  /** What they paid at close. */
  closingPrice: number | null;
  /** Latest AVM / current home value. */
  avmCurrent: number | null;
  /** When AVM was last refreshed. */
  avmUpdatedAt: string | null;
  /** Standard CRM engagement index 0–100ish. */
  engagementScore: number;
  lastActivityAt: string | null;
  lastContactedAt: string | null;
  /** Open signals (not dismissed). Same shape as spherePrediction. */
  openSignals: ReadonlyArray<{
    type: ContactSignalType;
    confidence: "low" | "medium" | "high";
    detectedAt: string;
  }>;
  relationshipType: string | null;
};

export const BUYER_PREDICTION_THRESHOLDS = {
  highMin: 70,
  mediumMin: 40,
} as const;

/**
 * Weight ceilings (max points each factor can contribute). Sum = 100.
 *
 *   Tenure                         25 (vs sphere's 30 — seller signal stronger)
 *   Buyer-intent signals           30 (vs sphere's 20 — these are HIGHER value
 *                                       for buyer prediction; job_change /
 *                                       life_event are very strong buy signals)
 *   Equity-to-upgrade              20 (vs sphere's 25 — equity matters but
 *                                       buyer-side it's about "can they afford
 *                                       up", not "will they cash out")
 *   Engagement uptick              15 (same as sphere)
 *   Anniversary / dormancy          10 (same as sphere)
 */
export const BUYER_PREDICTION_WEIGHTS = {
  tenure: 25,
  buyer_intent_signals: 30,
  equity_to_upgrade: 20,
  engagement_uptick: 15,
  anniversary_dormancy: 10,
} as const;
