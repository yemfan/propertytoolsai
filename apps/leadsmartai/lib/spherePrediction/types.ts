import type { ContactSignalType } from "@/lib/contacts/types";

/**
 * Sphere seller-prediction is the dual of `lib/dealPrediction` (buyer side).
 *
 *   dealPrediction:    "Will this LEAD become a closed deal?"  (buyer-funnel)
 *   spherePrediction:  "Will this PAST CLIENT or SPHERE contact list their
 *                       home in the next ~90 days?"  (seller-farming)
 *
 * Different signal set, different prompt-engineering downstream, different
 * agent workflow ("Today's likely sellers" daily picks vs. "Hot leads"
 * pipeline). Kept as a separate module so the two scoring engines can evolve
 * independently and so explainable factor breakdowns stay self-documenting.
 */

export type SphereSellerLabel = "high" | "medium" | "low";

export type SphereSellerFactor = {
  /** Stable id — used as a key in analytics + UI rendering. Do not rename. */
  id:
    | "tenure"
    | "equity_gain"
    | "open_signals"
    | "engagement_uptick"
    | "anniversary_dormancy";
  label: string;
  pointsEarned: number;
  pointsMax: number;
  /** Plain-English reason an agent can read on the lead profile. */
  detail: string;
};

export type SphereSellerScoreResult = {
  /** 0–100 capped. */
  score: number;
  label: SphereSellerLabel;
  factors: SphereSellerFactor[];
};

/**
 * Inputs assembled server-side by the service layer. All optional fields
 * degrade gracefully — a sphere contact with no closing data still gets a
 * computed score (just biased low).
 */
export type SphereSellerInput = {
  /** ISO date string when the contact bought their home (closing date). */
  homePurchaseDate: string | null;
  /** What they paid at close. */
  closingPrice: number | null;
  /** Latest AVM / current home value. */
  avmCurrent: number | null;
  /** When AVM was last refreshed — stale AVM weakens the equity signal. */
  avmUpdatedAt: string | null;
  /** Standard CRM engagement index 0–100ish. */
  engagementScore: number;
  lastActivityAt: string | null;
  lastContactedAt: string | null;
  /** Open signals (not dismissed) attached to the contact. */
  openSignals: ReadonlyArray<{
    type: ContactSignalType;
    confidence: "low" | "medium" | "high";
    detectedAt: string;
  }>;
  /** Relationship sub-type — past_buyer/past_seller weight differently. */
  relationshipType: string | null;
};

export const SPHERE_SELLER_THRESHOLDS = {
  highMin: 70,
  mediumMin: 40,
} as const;

/**
 * Weight ceilings (max points each factor can contribute). Sum = 100.
 * Centralized here so tests + UI can show "12 / 30 pts" deterministically.
 */
export const SPHERE_SELLER_WEIGHTS = {
  tenure: 30,
  equity_gain: 25,
  open_signals: 20,
  engagement_uptick: 15,
  anniversary_dormancy: 10,
} as const;
