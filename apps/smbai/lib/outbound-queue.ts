/**
 * Shared outbound-call mechanics (server-only). Used by both the single-contact
 * "AI Call" action and the bulk "Call all" flow. Kept out of the "use server"
 * action file because that file may only export server actions.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { createPhoneCall, getRetellNumber } from "@/lib/retell";
import {
  loadReceptionistContext,
  buildOutboundDynamicVariables,
  type OutboundPurpose,
  type ReceptionistContext,
} from "@/lib/receptionist-agent";
import { normalizePhoneE164 } from "@/lib/phone";

type ServiceClient = ReturnType<typeof createServiceClient>;
type QueueClient = { id: string; first_name: string; last_name: string | null; phone: string | null };

/** Only dial 8am–9pm in the business's timezone (compliance). */
export function withinCallingHours(timezone: string): boolean {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const hour = parseInt(hourStr, 10) % 24;
  return hour >= 8 && hour < 21;
}

/** The agent that places the call: the configured shared agent, else the one
 *  already bound to the number for inbound (so outbound needs no extra env). */
export async function resolveOutboundAgentId(ctx: ReceptionistContext): Promise<string | null> {
  let agentId = process.env.RETELL_AGENT_ID;
  if (!agentId && ctx.twilioNumber) {
    const wiring = await getRetellNumber(ctx.twilioNumber);
    agentId = wiring.agentIds[0];
  }
  return agentId || null;
}

/** Place one outbound call and log it as a voice_session. Assumes calling hours
 *  were already checked and the org context is loaded. Returns the Retell call id. */
export async function placeOutboundCall(
  db: ServiceClient,
  ctx: ReceptionistContext,
  client: QueueClient,
  purpose: OutboundPurpose,
  agentId: string
): Promise<string> {
  if (!ctx.twilioNumber) throw new Error("No phone number connected.");
  if (!client.phone) throw new Error("No phone number.");
  const toResult = normalizePhoneE164(client.phone);
  if (!toResult.ok) throw new Error(toResult.error);
  const to = toResult.value;

  const leadName = `${client.first_name}${client.last_name ? ` ${client.last_name}` : ""}`.trim();
  const dynamicVariables = buildOutboundDynamicVariables(ctx, { leadName, purpose });

  const { callId } = await createPhoneCall({
    fromNumber: ctx.twilioNumber,
    toNumber: to,
    agentId,
    dynamicVariables,
    metadata: { org_id: ctx.orgId, client_id: client.id, purpose },
  });

  await db.from("voice_sessions").insert({
    organization_id: ctx.orgId,
    call_sid: callId,
    from_number: ctx.twilioNumber,
    to_number: to,
    direction: "outbound",
    purpose,
    client_id: client.id,
    status: "active",
  });

  return callId;
}

/** Enqueue contacts for a bulk call, skipping any already pending. Returns the count enqueued. */
export async function enqueueCalls(
  db: ServiceClient,
  orgId: string,
  purpose: OutboundPurpose,
  clientIds: string[]
): Promise<number> {
  if (!clientIds.length) return 0;

  const { data: pending } = await db
    .from("outbound_call_queue")
    .select("client_id")
    .eq("organization_id", orgId)
    .eq("purpose", purpose)
    .in("status", ["queued", "calling"])
    .in("client_id", clientIds);
  const pendingSet = new Set((pending ?? []).map((r) => r.client_id as string));

  const toInsert = clientIds.filter((id) => !pendingSet.has(id));
  if (!toInsert.length) return 0;

  const { error } = await db
    .from("outbound_call_queue")
    .insert(toInsert.map((client_id) => ({ organization_id: orgId, client_id, purpose, status: "queued" })));
  if (error) throw new Error(error.message);
  return toInsert.length;
}

/** Dial queued rows for an org, staggered, up to `limit`. No-op outside hours. */
export async function drainOutboundQueue(
  db: ServiceClient,
  orgId: string,
  opts: { limit: number; staggerMs: number }
): Promise<{ placed: number; failed: number }> {
  const ctx = await loadReceptionistContext(db, orgId);
  if (!ctx.twilioNumber || !withinCallingHours(ctx.timezone)) return { placed: 0, failed: 0 };
  const agentId = await resolveOutboundAgentId(ctx);
  if (!agentId) return { placed: 0, failed: 0 };

  const { data: rows } = await db
    .from("outbound_call_queue")
    .select("id, client_id, purpose")
    .eq("organization_id", orgId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(opts.limit);
  if (!rows?.length) return { placed: 0, failed: 0 };

  let placed = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    await db
      .from("outbound_call_queue")
      .update({ status: "calling", attempts: 1, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    const { data: client } = await db
      .from("clients")
      .select("id, first_name, last_name, phone")
      .eq("id", row.client_id)
      .single();

    try {
      if (!client) throw new Error("Contact not found.");
      const callId = await placeOutboundCall(db, ctx, client as QueueClient, row.purpose as OutboundPurpose, agentId);
      await db
        .from("outbound_call_queue")
        .update({ status: "done", call_sid: callId, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      placed++;
    } catch (e) {
      await db
        .from("outbound_call_queue")
        .update({ status: "failed", last_error: e instanceof Error ? e.message : "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      failed++;
    }

    // Stagger initiations so a whole list doesn't ring at once.
    if (i < rows.length - 1 && opts.staggerMs > 0) {
      await new Promise((r) => setTimeout(r, opts.staggerMs));
    }
  }

  return { placed, failed };
}
