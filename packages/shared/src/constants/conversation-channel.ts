export const CONVERSATION_CHANNEL = {
  Sms: "sms",
  Email: "email",
  Call: "call",
  Chat: "chat",
  Other: "other",
} as const;

export type ConversationChannel = (typeof CONVERSATION_CHANNEL)[keyof typeof CONVERSATION_CHANNEL];
