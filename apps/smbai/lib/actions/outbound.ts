"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { loadReceptionistContext, type OutboundPurpose } from "@/lib/receptionist-agent";
import {
  placeOutboundCall,
  withinCallingHours,
  resolveOutboundAgentId,
  enqueueCalls,
  drainOutboundQueue,
} from "@/lib/outbound-queue";

type CallResult = { ok: true; name: string } | { ok: false; error: string };
type BulkResult = { ok: true; queued: number } | { ok: false; error: string };

// Cap a single "Call all" batch so the background drain finishes within the
// function's lifetime. Larger lists are handled by clicking again (already-queued
// contacts are skipped).
const BULK_LIMIT = 15;
const STAGGER_MS = 1500;

/**
 * Place a single outbound AI call to a contact. HelmSmart-initiated (the agent
 * dials) — distinct from the owner calling someone themselves. Guards: valid
 * phone, connected number, and 8am–9pm in the business's timezone.
 */
export async function callLead(input: { clientId: string; purpose: OutboundPurpose }): Promise<CallResult> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "No organization." };

  const db = createServiceClient();

  // Load the contact and the org context in parallel (they only need orgId).
  const [{ data: client }, ctx] = await Promise.all([
    db
      .from("clients")
      .select("id, first_name, last_name, phone")
      .eq("id", input.clientId)
      .eq("organization_id", orgId)
      .single(),
    loadReceptionistContext(db, orgId),
  ]);
  if (!client) return { ok: false, error: "Contact not found." };
  if (!client.phone) return { ok: false, error: "This contact has no phone number." };
  if (!ctx.twilioNumber) return { ok: false, error: "Connect a phone number first in Settings → AI Voice agent." };
  if (!withinCallingHours(ctx.timezone)) return { ok: false, error: "Outside calling hours (8am–9pm local). Try again later." };
  const agentId = await resolveOutboundAgentId(ctx);
  if (!agentId) return { ok: false, error: "No voice agent is connected to your number yet." };

  const leadName = `${client.first_name}${client.last_name ? ` ${client.last_name}` : ""}`.trim();
  try {
    await placeOutboundCall(db, ctx, client, input.purpose, agentId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Call failed to start." };
  }

  return { ok: true, name: leadName || "the contact" };
}

/**
 * Bulk "Call all": enqueue the given contacts for a purpose, then dial them in
 * the background — staggered, within calling hours, capped per batch. Returns how
 * many were newly queued (already-pending contacts are skipped).
 */
export async function callAll(input: { purpose: OutboundPurpose; clientIds: string[] }): Promise<BulkResult> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "No organization." };

  const db = createServiceClient();

  const ctx = await loadReceptionistContext(db, orgId);
  if (!ctx.twilioNumber) return { ok: false, error: "Connect a phone number first in Settings → AI Voice agent." };
  if (!withinCallingHours(ctx.timezone)) return { ok: false, error: "Outside calling hours (8am–9pm local). Try again later." };
  const agentId = await resolveOutboundAgentId(ctx);
  if (!agentId) return { ok: false, error: "No voice agent is connected to your number yet." };

  // Validate the requested contacts belong to this org + have a phone; cap the batch.
  const requested = Array.from(new Set(input.clientIds)).slice(0, BULK_LIMIT);
  if (!requested.length) return { ok: false, error: "No contacts selected." };

  const { data: valid } = await db
    .from("clients")
    .select("id")
    .eq("organization_id", orgId)
    .not("phone", "is", null)
    .in("id", requested);
  const validIds = (valid ?? []).map((c) => c.id as string);
  if (!validIds.length) return { ok: false, error: "No reachable contacts (they need a phone number)." };

  const queued = await enqueueCalls(db, orgId, input.purpose, validIds);
  if (queued === 0) return { ok: false, error: "Those contacts are already queued or being called." };

  // Dial the batch in the background so the click returns immediately.
  after(async () => {
    await drainOutboundQueue(db, orgId, { limit: BULK_LIMIT, staggerMs: STAGGER_MS });
  });

  return { ok: true, queued };
}
