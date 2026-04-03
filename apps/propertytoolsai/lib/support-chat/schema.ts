import { z } from "zod";

export const startConversationSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email(),
  subject: z.string().max(200).optional(),
  initialMessage: z.string().min(1).max(5000),
  source: z.string().max(100).optional().default("propertytools_assigned_agent"),
  customerUserId: z.string().uuid().optional().nullable(),
  assignedAgentAuthUserId: z.string().uuid().optional().nullable(),
  assignedAgentName: z.string().max(120).optional().nullable(),
  /** When true, server may SMS the agent (Twilio + phone + env). Offline-only behavior is future refinement. */
  notifyAgentSms: z.boolean().optional(),
});

export const sendMessageSchema = z.object({
  conversationPublicId: z.string().min(3),
  senderType: z.enum(["customer", "support", "system", "ai"]),
  senderName: z.string().max(120).optional(),
  senderEmail: z.string().email().optional(),
  body: z.string().min(1).max(5000),
  isInternalNote: z.boolean().optional().default(false),
});

export const markReadSchema = z.object({
  conversationPublicId: z.string().min(3),
  readerType: z.enum(["customer", "support"]),
});
