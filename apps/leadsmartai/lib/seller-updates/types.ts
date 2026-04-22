/**
 * Shared types for the weekly seller-update report.
 *
 * The snapshot is the structured input to the AI commentary prompt
 * + the email renderer. Pure data shapes — no DB, no AI.
 */

export type VisitorTimeline =
  | "now"
  | "3_6_months"
  | "6_12_months"
  | "later"
  | "just_looking";

export type ListingActivitySnapshot = {
  // Listing identity
  propertyAddress: string;
  listPrice: number | null;
  listingStartDate: string | null; // YYYY-MM-DD
  daysOnMarket: number | null; // null if listing_start_date missing

  // Report window
  windowStartIso: string;
  windowEndIso: string;

  // Open-house activity IN THE WINDOW
  openHousesHeldCount: number;
  visitorsTotal: number;
  visitorsHot: number; // timeline = 'now'
  visitorsAgented: number;
  visitorsOptedIn: number;
  visitorTimelineBreakdown: Record<VisitorTimeline, number>;
  // Up to 5 visitor notes (anonymized — no names).
  visitorNoteSnippets: string[];

  // Offer activity IN THE WINDOW
  offersReceivedCount: number;
  offersActiveCount: number;
  offersAcceptedCount: number;
  offersRejectedCount: number;
  offerPriceRange: { min: number; max: number } | null;

  // Cumulative-to-date counters (not window-bound) for "compared to listing start"
  lifetimeVisitors: number;
  lifetimeOffers: number;
};

/**
 * The Claude-generated advice block. Lives inside the email.
 */
export type SellerCommentary = {
  /** 1-2 sentence market summary. "Activity is steady — 3 visitors this week." */
  summary: string;
  /** 2-3 concrete observations. "70% of visitors rated timeline 6+ months…" */
  observations: string[];
  /** 1 imperative recommendation. "Consider a price adjustment to the $1.2M band…" */
  recommendation: string;
  /** true if the recommendation is a price-reduction suggestion. Drives a badge in the email. */
  suggestsPriceReduction: boolean;
};
