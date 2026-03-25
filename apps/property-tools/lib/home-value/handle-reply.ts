import { supabaseAdmin } from "@/lib/supabase/admin";
import { pausePendingSequenceForLead } from "./pause-sequence";

type HandleReplyInput = {
  leadId: string;
  channel: "email" | "sms" | "chat";
  message: string;
};

export async function handleLeadReply(input: HandleReplyInput) {
  await pausePendingSequenceForLead(input.leadId);

  const { error } = await supabaseAdmin
    .from("lead_followups")
    .insert({
      lead_id: input.leadId,
      assigned_agent_id: null,
      channel: input.channel,
      subject: null,
      message: input.message,
      status: "sent",
      step_number: 0,
      scheduled_for: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      template_key: "lead_reply",
      sequence_key: null,
      metadata: {
        direction: "inbound",
      },
    });

  if (error) throw error;

  return { success: true };
}
