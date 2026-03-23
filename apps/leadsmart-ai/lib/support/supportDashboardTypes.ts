export type SupportStatus =
  | "open"
  | "waiting_on_support"
  | "waiting_on_customer"
  | "resolved"
  | "closed";

export type SupportPriority = "low" | "normal" | "high" | "urgent";
export type SenderType = "customer" | "support" | "system" | "ai";

export type SupportMessage = {
  id: string;
  senderType: SenderType;
  senderName?: string;
  senderEmail?: string;
  body: string;
  createdAt: string;
  isInternalNote?: boolean;
};

export type SupportConversation = {
  id: string;
  publicId: string;
  customerName: string;
  customerEmail: string;
  subject?: string;
  status: SupportStatus;
  priority: SupportPriority;
  assignedAgentName?: string;
  unreadForSupport: number;
  unreadForCustomer: number;
  lastMessageAt?: string;
  messages: SupportMessage[];
};
