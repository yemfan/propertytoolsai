import type { SupportConversation as PrismaConv, SupportMessage as PrismaMsg } from "@prisma/client";
import type {
  SupportConversation as UiConv,
  SupportMessage as UiMsg,
  SupportPriority,
  SupportStatus,
  SenderType,
} from "./supportDashboardTypes";

export function prismaMessageToUi(m: PrismaMsg): UiMsg {
  return {
    id: m.id,
    senderType: m.senderType as SenderType,
    senderName: m.senderName ?? undefined,
    senderEmail: m.senderEmail ?? undefined,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    isInternalNote: m.isInternalNote,
  };
}

/** List row / summary without loading messages. */
export function prismaConversationToSummary(c: PrismaConv): Omit<UiConv, "messages"> {
  return {
    id: c.id,
    publicId: c.publicId,
    customerName: c.customerName,
    customerEmail: c.customerEmail,
    subject: c.subject ?? undefined,
    status: c.status as SupportStatus,
    priority: c.priority as SupportPriority,
    assignedAgentName: c.assignedAgentName ?? undefined,
    unreadForSupport: c.unreadForSupport,
    unreadForCustomer: c.unreadForCustomer,
    lastMessageAt: c.lastMessageAt?.toISOString(),
  };
}

export function prismaConversationToUi(
  c: PrismaConv & { messages: PrismaMsg[] }
): UiConv {
  return {
    ...prismaConversationToSummary(c),
    messages: c.messages.map(prismaMessageToUi),
  };
}
