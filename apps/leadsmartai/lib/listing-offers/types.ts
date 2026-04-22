/**
 * Shared types for the listing-side offer review feature.
 */

export type ListingOfferStatus =
  | "submitted"
  | "countered"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired";

export type FinancingType = "cash" | "conventional" | "fha" | "va" | "jumbo" | "other";

export type CounterDirection = "seller_to_buyer" | "buyer_to_seller";

export type ListingOfferRow = {
  id: string;
  agent_id: string;
  transaction_id: string;

  buyer_name: string | null;
  buyer_brokerage: string | null;
  buyer_agent_name: string | null;
  buyer_agent_email: string | null;
  buyer_agent_phone: string | null;

  offer_price: number;
  current_price: number | null;
  earnest_money: number | null;
  down_payment: number | null;
  financing_type: FinancingType | null;
  closing_date_proposed: string | null;

  inspection_contingency: boolean;
  appraisal_contingency: boolean;
  loan_contingency: boolean;
  sale_of_home_contingency: boolean;
  contingency_notes: string | null;

  seller_concessions: number | null;

  status: ListingOfferStatus;
  offer_expires_at: string | null;
  submitted_at: string | null;
  accepted_at: string | null;
  closed_at: string | null;

  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingOfferCounterRow = {
  id: string;
  listing_offer_id: string;
  counter_number: number;
  direction: CounterDirection;
  price: number | null;
  changed_fields: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

/**
 * Compare-view row: offer + the three derived "how many contingencies",
 * "is cash", "counter count" fields the compare table needs without
 * looking them up per-row.
 */
export type ListingOfferCompareItem = ListingOfferRow & {
  counter_count: number;
  contingency_count: number;
  is_cash: boolean;
};
