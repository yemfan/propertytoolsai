export type EmailAssistantIntent =
  | "buyer_listing_inquiry"
  | "buyer_financing"
  | "seller_home_value"
  | "seller_list_home"
  | "appointment"
  | "support"
  | "document_request"
  | "unknown";

export type EmailLeadSnapshot = {
  leadId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  leadScore?: number | null;
  leadTemperature?: string | null;
  propertyAddress?: string | null;
  city?: string | null;
  state?: string | null;
  intent?: string | null;
  assignedAgentId?: string | null;
};

export type EmailReplyContext = {
  fromEmail: string;
  toEmail: string;
  subject: string;
  inboundBody: string;
  lead: EmailLeadSnapshot | null;
  recentMessages: Array<{
    direction: "inbound" | "outbound";
    subject?: string | null;
    body: string;
    createdAt: string;
  }>;
  inferredIntent: EmailAssistantIntent;
};

export type EmailAssistantReply = {
  subject: string;
  replyBody: string;
  inferredIntent: EmailAssistantIntent;
  extractedData?: {
    name?: string;
    phone?: string;
    email?: string;
    propertyAddress?: string;
    timeline?: string;
    budget?: number;
  };
  nextBestAction:
    | "continue_ai"
    | "notify_agent"
    | "schedule_call"
    | "send_valuation_link"
    | "send_listing_link"
    | "request_documents";
  hotLead: boolean;
  needsHuman: boolean;
  tags: string[];
};
