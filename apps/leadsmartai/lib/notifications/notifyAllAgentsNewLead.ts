import { supabaseAdmin } from "@/lib/supabase/admin";
import { insertAgentInboxNotification } from "./agentNotifications";

/**
 * Notify every agent that a new lead is available in the queue.
 * Best-effort: failures are logged but never propagated.
 */
export async function notifyAllAgentsNewLead(params: {
  leadId: string;
  leadName: string;
  leadSource: string;
}): Promise<void> {
  try {
    const { data: agents, error } = await supabaseAdmin
      .from("agents")
      .select("id");

    if (error || !agents?.length) return;

    await Promise.allSettled(
      agents.map((agent) =>
        insertAgentInboxNotification({
          agentId: String((agent as { id: number | string }).id),
          type: "new_lead",
          priority: "medium",
          title: "New lead available",
          body: `${params.leadName} (${params.leadSource}) is available to claim.`,
          deepLink: {
            screen: "lead_queue",
            leadId: params.leadId,
          },
        })
      )
    );
  } catch (e) {
    console.warn("notifyAllAgentsNewLead: failed", e);
  }
}
