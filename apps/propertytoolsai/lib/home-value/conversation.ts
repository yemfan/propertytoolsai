import { supabaseAdmin } from "@/lib/supabase/admin";
import { scheduleLeadScoreRefresh } from "@/lib/lead-scoring/service";

type AddConversationMessageInput = {
  leadId: string;
  direction: "inbound" | "outbound" | "internal";
  channel?: "email" | "sms" | "chat";
  subject?: string | null;
  message: string;
  senderName?: string | null;
  senderEmail?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  status?: string;
  relatedFollowupId?: string | null;
};

export async function addConversationMessage(input: AddConversationMessageInput) {
  const { data, error } = await supabaseAdmin
    .from("lead_conversations")
    .insert({
      lead_id: input.leadId,
      direction: input.direction,
      channel: input.channel ?? "email",
      subject: input.subject ?? null,
      message: input.message,
      sender_name: input.senderName ?? null,
      sender_email: input.senderEmail ?? null,
      recipient_name: input.recipientName ?? null,
      recipient_email: input.recipientEmail ?? null,
      status: input.status ?? "sent",
      related_followup_id: input.relatedFollowupId ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  scheduleLeadScoreRefresh(input.leadId);
  return data;
}
