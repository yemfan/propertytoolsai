/**
 * Shared types for the buyer-side showings feature.
 *
 * DB row shapes live here so the service + API layers don't duplicate.
 * UI-only types stay with the components that use them.
 */

export type ShowingStatus = "scheduled" | "attended" | "cancelled" | "no_show";

export type OverallReaction = "love" | "like" | "maybe" | "pass";

export type ShowingRow = {
  id: string;
  agent_id: string;
  contact_id: string;

  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mls_number: string | null;
  mls_url: string | null;

  scheduled_at: string; // ISO timestamptz
  duration_minutes: number | null;

  access_notes: string | null;
  listing_agent_name: string | null;
  listing_agent_email: string | null;
  listing_agent_phone: string | null;

  status: ShowingStatus;
  cancellation_reason: string | null;
  notes: string | null;

  /** Google Calendar event id. Null = never synced, agent hasn't connected
      Google Calendar, or sync failed (failures are swallowed — see service). */
  google_event_id: string | null;

  created_at: string;
  updated_at: string;
};

export type ShowingFeedbackRow = {
  id: string;
  showing_id: string;

  rating: number | null;
  overall_reaction: OverallReaction | null;

  pros: string | null;
  cons: string | null;
  notes: string | null;

  would_offer: boolean;
  price_concerns: boolean;
  location_concerns: boolean;
  condition_concerns: boolean;

  created_at: string;
  updated_at: string;
};

/**
 * List-view item: showing + denormalized contact name + feedback summary.
 * Built server-side so the list page doesn't N+1 over join tables.
 */
export type ShowingListItem = ShowingRow & {
  contact_name: string | null;
  feedback_rating: number | null;
  feedback_reaction: OverallReaction | null;
  feedback_would_offer: boolean;
};

/**
 * Per-contact roll-up used by the Contacts page badge ("3 showings, 1 ♥").
 */
export type ContactShowingStats = {
  total: number;
  attended: number;
  scheduled: number;
  loved: number;
  wouldOfferCount: number;
};
