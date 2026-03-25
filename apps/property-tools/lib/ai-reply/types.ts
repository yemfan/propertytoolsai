export type LeadSourceType =
  | "listing_inquiry"
  | "home_value_estimate"
  | "affordability_report"
  | "unknown";

export type ReplyTone = "professional" | "friendly" | "urgent" | "consultative";

export type ReplyGoal =
  | "answer_question"
  | "book_tour"
  | "move_to_call"
  | "collect_financing_info"
  | "send_similar_homes"
  | "general_followup";

export type ConversationMessage = {
  direction: "inbound" | "outbound" | "internal";
  subject?: string | null;
  message: string;
  created_at?: string;
  sender_name?: string | null;
};

export type ListingContext = {
  listingId?: string;
  listingAddress?: string;
  price?: number;
  requestedTime?: string | null;
  city?: string;
  zip?: string;
};

export type BuyerContext = {
  maxHomePrice?: number;
  preferredCity?: string;
  preferredZip?: string;
  timeline?: string;
  alreadyPreapproved?: boolean;
  firstTimeBuyer?: boolean;
  veteran?: boolean;
};

export type LeadReplyContext = {
  leadId: string;
  leadName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  leadSource: LeadSourceType;
  intent?: string | null;
  notes?: string | null;
  engagementScore?: number | null;
  listing?: ListingContext | null;
  buyer?: BuyerContext | null;
  conversation: ConversationMessage[];
  latestInboundMessage?: string | null;
  agentName?: string | null;
  /** Broker or team playbook / talk tracks (optional; e.g. from env or DB later). */
  agentPlaybookSummary?: string | null;
};

export type SuggestedReply = {
  subject?: string | null;
  body: string;
  tone: ReplyTone;
  goal: ReplyGoal;
  label: string;
};

export type AIReplyResponse = {
  suggestions: SuggestedReply[];
  reasoningSummary: string;
};
