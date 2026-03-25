import { supabaseAdmin } from "@/lib/supabase/admin";

export async function seedListingConversationThread(input: {
  leadId: string;
  customerName: string;
  customerEmail: string;
  listingAddress: string;
  actionType: "ask_agent" | "contact_agent" | "schedule_tour";
  notes?: string;
  requestedTime?: string | null;
}) {
  const inboundMessage =
    input.actionType === "schedule_tour"
      ? `New tour request for ${input.listingAddress}.${input.requestedTime ? ` Requested time: ${input.requestedTime}.` : ""}${input.notes ? ` Notes: ${input.notes}` : ""}`
      : `New listing inquiry for ${input.listingAddress}.${input.notes ? ` Notes: ${input.notes}` : ""}`;

  const { error } = await supabaseAdmin.from("lead_conversations").insert({
    lead_id: input.leadId,
    direction: "inbound",
    channel: "chat",
    subject: input.actionType === "schedule_tour" ? "Tour request" : "Listing inquiry",
    message: inboundMessage,
    sender_name: input.customerName,
    sender_email: input.customerEmail,
    recipient_name: null,
    recipient_email: null,
    status: "sent",
    metadata: {
      source: "listing_ui",
      listing_address: input.listingAddress,
      action_type: input.actionType,
    },
  });

  if (error) throw error;
}
