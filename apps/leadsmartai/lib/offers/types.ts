/**
 * Shared types for the buyer-side offer tracker.
 */

export type OfferStatus =
  | "draft"
  | "submitted"
  | "countered"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired";

export const ACTIVE_OFFER_STATUSES: OfferStatus[] = ["draft", "submitted", "countered"];
export const WON_OFFER_STATUSES: OfferStatus[] = ["accepted"];
export const LOST_OFFER_STATUSES: OfferStatus[] = ["rejected", "withdrawn", "expired"];

export type FinancingType = "cash" | "conventional" | "fha" | "va" | "jumbo" | "other";

export type CounterDirection = "seller_to_buyer" | "buyer_to_seller";

export type OfferRow = {
  id: string;
  agent_id: string;
  contact_id: string;

  showing_id: string | null;
  transaction_id: string | null;

  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mls_number: string | null;
  mls_url: string | null;
  list_price: number | null;

  offer_price: number;
  earnest_money: number | null;
  down_payment: number | null;
  financing_type: FinancingType | null;
  closing_date_proposed: string | null;

  inspection_contingency: boolean;
  appraisal_contingency: boolean;
  loan_contingency: boolean;
  contingency_notes: string | null;

  status: OfferStatus;
  current_price: number | null;
  offer_expires_at: string | null;

  submitted_at: string | null;
  accepted_at: string | null;
  closed_at: string | null;

  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OfferCounterRow = {
  id: string;
  offer_id: string;
  counter_number: number;
  direction: CounterDirection;
  price: number | null;
  changed_fields: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

/**
 * Denormalized list-view item — offer + buyer name + counter count.
 */
export type OfferListItem = OfferRow & {
  contact_name: string | null;
  counter_count: number;
};

/**
 * Per-contact roll-up for the Contacts page badge.
 */
export type ContactOfferStats = {
  total: number;
  active: number;
  won: number;
  lost: number;
};
