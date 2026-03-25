import { supabaseAdmin } from "@/lib/supabase/admin";
import { scheduleLeadScoreRefresh } from "@/lib/lead-scoring/service";

export type LogLeadActivityInput = {
  leadId: string;
  eventType: string;
  title: string;
  description?: string | null;
  source?: string | null;
  actorType?: string | null;
  actorName?: string | null;
  actorId?: string | null;
  relatedFollowupId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Appends a row to {@link lead_activity_events} (shared CRM activity log).
 */
export async function logLeadActivity(input: LogLeadActivityInput) {
  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.relatedFollowupId ? { relatedFollowupId: input.relatedFollowupId } : {}),
  };

  const { error } = await supabaseAdmin.from("lead_activity_events").insert({
    lead_id: input.leadId,
    event_type: input.eventType,
    title: input.title,
    description: input.description ?? null,
    source: input.source ?? null,
    actor_type: input.actorType ?? null,
    actor_name: input.actorName ?? null,
    actor_id: input.actorId ?? null,
    metadata,
  });

  if (error) throw error;

  scheduleLeadScoreRefresh(input.leadId);
}
