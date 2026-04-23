/**
 * Shared types for the cross-agent listing-feedback feature.
 */

export type OverallReaction = "love" | "like" | "maybe" | "pass";
export type PriceFeedback = "too_high" | "about_right" | "bargain";

export type ListingFeedbackRow = {
  id: string;
  agent_id: string;
  transaction_id: string;

  buyer_agent_name: string | null;
  buyer_agent_email: string | null;
  buyer_agent_phone: string | null;
  buyer_agent_brokerage: string | null;
  buyer_name: string | null;

  showing_date: string | null;

  request_slug: string;
  request_email_sent_at: string | null;

  submitted_at: string | null;
  rating: number | null;
  overall_reaction: OverallReaction | null;
  pros: string | null;
  cons: string | null;
  price_feedback: PriceFeedback | null;
  would_offer: boolean | null;
  notes: string | null;

  created_at: string;
  updated_at: string;
};
