import { supabaseAdmin } from "@/lib/supabase/admin";

type CreateAgentNotificationInput = {
  agentId: string;
  leadId?: string | null;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createAgentNotification(input: CreateAgentNotificationInput) {
  const { data, error } = await supabaseAdmin
    .from("agent_notifications")
    .insert({
      agent_id: input.agentId,
      lead_id: input.leadId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      action_url: input.actionUrl ?? null,
      metadata: input.metadata ?? {},
      status: "unread",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
