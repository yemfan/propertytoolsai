export type ChatAssistantLeadSource =
  | "listing_inquiry"
  | "home_value_estimate"
  | "affordability_report"
  | "smart_property_match"
  | "unknown";

export type ChatAssistantMessage = {
  direction: "inbound" | "outbound" | "internal";
  message: string;
  subject?: string | null;
  createdAt?: string;
  senderName?: string | null;
};

export type NextBestAction = {
  label: string;
  reason: string;
  actionType:
    | "send_reply"
    | "book_call"
    | "schedule_tour"
    | "send_similar_homes"
    | "request_financing_info"
    | "send_cma"
    | "follow_up_later";
  priority: "high" | "medium" | "low";
};

export type DraftReply = {
  label: string;
  subject?: string | null;
  body: string;
};

export type ChatAssistantContext = {
  leadId: string;
  leadName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  leadSource: ChatAssistantLeadSource;
  intent?: string | null;
  city?: string | null;
  zip?: string | null;
  notes?: string | null;
  engagementScore?: number | null;
  smartMatchPreferences?: Record<string, unknown> | null;
  listingAddress?: string | null;
  listingPrice?: number | null;
  requestedTourTime?: string | null;
  affordabilityBudget?: number | null;
  homeValueEstimate?: number | null;
  conversation: ChatAssistantMessage[];
  agentName?: string | null;
};

export type ChatAssistantResponse = {
  summary: string;
  sentiment: "hot" | "warm" | "cold";
  nextBestActions: NextBestAction[];
  suggestedReplies: DraftReply[];
};
