import { z } from "zod";

export const startConversationSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email(),
  subject: z.string().max(200).optional(),
  initialMessage: z.string().min(1).max(5000),
  source: z.string().max(100).optional().default("website_chat"),
});

export const sendMessageSchema = z.object({
  conversationPublicId: z.string().min(3),
  senderType: z.enum(["customer", "support", "system", "ai"]),
  senderName: z.string().max(120).optional(),
  senderEmail: z.string().email().optional(),
  body: z.string().min(1).max(5000),
  isInternalNote: z.boolean().optional().default(false),
});

/** GET /api/support-chat/conversation */
export const listMessagesQuerySchema = z.object({
  conversationPublicId: z.string().min(3),
});

export const updateConversationSchema = z.object({
  conversationPublicId: z.string().min(3),
  status: z
    .enum([
      "open",
      "waiting_on_support",
      "waiting_on_customer",
      "resolved",
      "closed",
    ])
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedAgentId: z.string().max(100).optional(),
  assignedAgentName: z.string().max(120).optional(),
});

export const markReadSchema = z.object({
  conversationPublicId: z.string().min(3),
  readerType: z.enum(["customer", "support"]),
});
