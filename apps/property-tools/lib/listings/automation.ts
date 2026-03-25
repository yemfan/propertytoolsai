import { logLeadActivity } from "@/lib/activity/logLeadActivity";
import { queueListingLeadSequence } from "./followup-sequence";
import { seedListingConversationThread } from "./conversation";

export async function connectListingLeadToAutomation(input: {
  leadId: string;
  assignedAgent?: { agentId: string; fullName: string; email?: string | null } | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  listingId: string;
  listingAddress: string;
  actionType: "ask_agent" | "contact_agent" | "schedule_tour";
  requestedTime?: string | null;
  notes?: string;
}) {
  await seedListingConversationThread({
    leadId: input.leadId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    listingAddress: input.listingAddress,
    actionType: input.actionType,
    notes: input.notes,
    requestedTime: input.requestedTime,
  });

  await queueListingLeadSequence({
    leadId: input.leadId,
    assignedAgentId: input.assignedAgent?.agentId ?? null,
    assignedAgentName: input.assignedAgent?.fullName ?? null,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone ?? null,
    listingId: input.listingId,
    listingAddress: input.listingAddress,
    actionType: input.actionType,
    requestedTime: input.requestedTime ?? null,
  });

  await logLeadActivity({
    leadId: input.leadId,
    eventType: "message_replied",
    title: "Inbound listing inquiry received",
    description:
      input.actionType === "schedule_tour"
        ? `Tour request submitted for ${input.listingAddress}`
        : `Inquiry submitted for ${input.listingAddress}`,
    source: "listing_ui",
    actorType: "customer",
    actorName: input.customerName,
    metadata: {
      listingId: input.listingId,
      listingAddress: input.listingAddress,
      actionType: input.actionType,
      requestedTime: input.requestedTime ?? null,
    },
  });
}
