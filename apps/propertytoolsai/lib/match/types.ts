export type BuyerPreferences = {
  budget: number;
  city?: string;
  state?: string;
  beds?: number;
  baths?: number;
  lifestyle?: "family" | "investment" | "commute" | "luxury";
  timeline?: "asap" | "3_months" | "6_months";
};

export type PropertyMatch = {
  id: string;
  address: string;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  matchScore: number;
  matchReasons: string[];
};

/** Minimal listing shape the scoring engine accepts (includes RentCast-normalized rows). */
export type MatchableListing = {
  id: string;
  address: string;
  city?: string;
  state?: string;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  /** When present (rare from MLS), boosts investment scoring. */
  rentEstimate?: number;
  daysOnMarket?: number;
  propertyType?: string;
};
