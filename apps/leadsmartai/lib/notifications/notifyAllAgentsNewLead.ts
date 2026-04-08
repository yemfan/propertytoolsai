import { supabaseAdmin } from "@/lib/supabase/admin";
import { insertAgentInboxNotification } from "./agentNotifications";
import { dispatchMobileHotLeadPush } from "@/lib/mobile/pushDispatch";

/**
 * Notify every agent that a new lead is available in the queue.
 * Creates inbox notification + sends mobile push to each agent.
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
      .select("id, auth_user_id");

    if (error || !agents?.length) return;

    await Promise.allSettled(
      agents.map(async (agent) => {
        const agentId = String((agent as { id: number | string }).id);
        const authUserId = (agent as { auth_user_id?: string | null }).auth_user_id;

        // Inbox notification
        await insertAgentInboxNotification({
          agentId,
          type: "new_lead",
          priority: "medium",
          title: "New lead available",
          body: `${params.leadName} (${params.leadSource}) is available to claim.`,
          deepLink: {
            screen: "lead_queue",
            leadId: params.leadId,
          },
        });

        // Mobile push notification (best-effort)
        if (authUserId) {
          await dispatchMobileHotLeadPush({
            userId: authUserId,
            agentId,
            leadId: params.leadId,
            title: "New lead available",
            body: `${params.leadName} (${params.leadSource}) is ready to claim.`,
          }).catch(() => {});
        }
      })
    );
  } catch (e) {
    console.warn("notifyAllAgentsNewLead: failed", e);
  }
}
