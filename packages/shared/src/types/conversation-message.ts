import type { ConversationChannel } from "../constants/conversation-channel";

/**
 * Generic chat turn (client portal, AI assistant, or support) — not necessarily persisted as SMS.
 */
export type ConversationTurnRole = "user" | "assistant" | "system" | "agent" | string;

export type ConversationTurn = {
  id?: string;
  role: ConversationTurnRole;
  content: string;
  createdAt?: string;
  channel?: ConversationChannel | null;
};

/**
 * Lightweight message shape used in several LeadSmart AI JSON blobs (`messages` arrays).
 */
export type ThreadMessageSnake = {
  id?: string;
  role?: string;
  content?: string;
  body?: string;
  created_at?: string;
  sent_at?: string;
  channel?: string;
};
