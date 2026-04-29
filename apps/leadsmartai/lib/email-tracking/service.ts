import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ParsedEmailEvent } from "./eventMapping";
import type { EmailEvent, EmailEventType } from "./types";

/**
 * Server-side ingestion + read for email_events.
 *
 * The webhook handler at app/api/webhooks/resend/route.ts calls
 * `recordEmailEvent` after verifying the Svix signature. The agent
 * dashboard reads via `getAgentEvents` / `getLeadEvents`.
 *
 * RLS: writes go through the service-role client, so RLS doesn't
 * apply. Reads on the agent surface should go through the user
 * client, which the SELECT policy filters by auth_user_id.
 */

export async function recordEmailEvent(
  event: ParsedEmailEvent,
  svixId: string | null,
): Promise<{ inserted: boolean; reason?: string }> {
  // Resolve agent + contact from the original send via email_messages.
  const { data: msg, error: msgErr } = await supabaseAdmin
    .from("email_messages")
    .select("agent_id, contact_id")
    .eq("external_message_id", event.externalMessageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (msgErr) {
    console.warn("[email-tracking] email_messages lookup failed:", msgErr);
  }

  const row: Record<string, unknown> = {
    external_message_id: event.externalMessageId,
    event_id: svixId ?? null,
    agent_id: (msg as { agent_id?: string | null } | null)?.agent_id ?? null,
    contact_id: (msg as { contact_id?: string | null } | null)?.contact_id ?? null,
    event_type: event.eventType,
    url: event.url,
    metadata: event.metadata,
    occurred_at: event.occurredAt,
  };

  const { error } = await supabaseAdmin.from("email_events").insert(row);
  if (error) {
    // Unique violation on event_id = duplicate webhook delivery.
    // That's expected and idempotent — return inserted=false so the
    // route still 200's.
    if ((error as { code?: string }).code === "23505") {
      return { inserted: false, reason: "duplicate" };
    }
    console.warn("[email-tracking] insert failed:", error);
    return { inserted: false, reason: error.message };
  }
  return { inserted: true };
}

/**
 * All events for one agent within a time window. Used by the stats
 * card on the dashboard. Uses the service-role client because the
 * caller has already resolved the agent context.
 */
export async function getAgentEvents(
  agentId: string,
  opts: { sinceIso?: string; untilIso?: string; limit?: number } = {},
): Promise<EmailEvent[]> {
  let q = supabaseAdmin
    .from("email_events")
    .select("*")
    .eq("agent_id", agentId)
    .order("occurred_at", { ascending: false })
    .limit(opts.limit ?? 1000);
  if (opts.sinceIso) q = q.gte("occurred_at", opts.sinceIso);
  if (opts.untilIso) q = q.lte("occurred_at", opts.untilIso);

  const { data, error } = await q;
  if (error) {
    console.warn("[email-tracking] getAgentEvents failed:", error);
    return [];
  }
  return (data ?? []).map(mapRow);
}

/**
 * All events for one contact's email thread. Renders inline icons in the
 * contact detail timeline (delivered ✓, opened 👁, clicked 🔗).
 */
export async function getContactEvents(contactId: string): Promise<EmailEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("email_events")
    .select("*")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error) {
    console.warn("[email-tracking] getContactEvents failed:", error);
    return [];
  }
  return (data ?? []).map(mapRow);
}

function mapRow(row: Record<string, unknown>): EmailEvent {
  return {
    id: String(row.id ?? ""),
    externalMessageId: String(row.external_message_id ?? ""),
    eventId: (row.event_id as string | null) ?? null,
    agentId: (row.agent_id as string | null) ?? null,
    contactId: (row.contact_id as string | null) ?? null,
    eventType: (row.event_type as EmailEventType) ?? "sent",
    url: (row.url as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    occurredAt: String(row.occurred_at ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}
