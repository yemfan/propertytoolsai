import type { ConversationChannel } from "../constants/conversation-channel";
import type { LeadId } from "./lead";

export type LeadConversationId = string;

export type LeadConversationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  sentAt: string;
  channel: ConversationChannel;
};

/** Thread summary for CRM inbox / mobile. */
export type LeadConversation = {
  id: LeadConversationId;
  leadId: LeadId;
  channel: ConversationChannel;
  subject: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  messages?: LeadConversationMessage[];
};

/** Alias for consumers that prefer generic “conversation” naming. */
export type ConversationThread = LeadConversation;
export type ConversationThreadMessage = LeadConversationMessage;
