import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTrackingNumber, normalizeE164, type TrackingNumberRow } from "./lookup";

/**
 * Server-side service for the tracking-numbers system.
 *
 * - `findActiveByPhone(toPhone)` — inbound voice/SMS hot path
 * - `listForAgent(agentId)` — settings UI
 * - `createOrUpdate(input)` — settings UI write path
 *
 * The inbound voice route at /api/twilio/voice (and similarly for
 * SMS) calls findActiveByPhone, then attributes the resulting lead
 * with the `source_label`. Existing lead-source ROI infra picks
 * up the rest — no further changes needed there.
 */

export async function findActiveByPhone(
  toPhone: string,
): Promise<TrackingNumberRow | null> {
  const normalized = normalizeE164(toPhone);
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin
    .from("tracking_numbers")
    .select("id, agent_id, phone_e164, source_label, forward_to_phone, is_active")
    .eq("phone_e164", normalized)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function listForAgent(
  agentId: string,
): Promise<TrackingNumberRow[]> {
  const { data, error } = await supabaseAdmin
    .from("tracking_numbers")
    .select("id, agent_id, phone_e164, source_label, forward_to_phone, is_active")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[tracking-numbers] listForAgent failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * Compatibility helper for legacy callers that fetch the full set
 * and then call the pure `findTrackingNumber`. New code should
 * prefer `findActiveByPhone` (single-row query) which is cheaper.
 */
export async function findTrackingNumberForAgent(args: {
  toPhone: string;
  agentId: string;
}): Promise<TrackingNumberRow | null> {
  const rows = await listForAgent(args.agentId);
  return findTrackingNumber(args.toPhone, rows);
}

export async function createOrUpdate(input: {
  agentId: string;
  phoneE164: string;
  sourceLabel: string;
  forwardToPhone?: string | null;
  isActive?: boolean;
}): Promise<TrackingNumberRow> {
  const phone = normalizeE164(input.phoneE164);
  if (!phone) throw new Error("Invalid phone_e164");

  const { data, error } = await supabaseAdmin
    .from("tracking_numbers")
    .upsert(
      {
        agent_id: input.agentId,
        phone_e164: phone,
        source_label: input.sourceLabel.trim(),
        forward_to_phone: input.forwardToPhone ?? null,
        is_active: input.isActive ?? true,
      },
      { onConflict: "phone_e164" },
    )
    .select("id, agent_id, phone_e164, source_label, forward_to_phone, is_active")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save tracking number");
  }
  return mapRow(data as Record<string, unknown>);
}

function mapRow(row: Record<string, unknown>): TrackingNumberRow {
  return {
    id: String(row.id ?? ""),
    agentId: String(row.agent_id ?? ""),
    phoneE164: String(row.phone_e164 ?? ""),
    sourceLabel: String(row.source_label ?? ""),
    forwardToPhone: (row.forward_to_phone as string | null) ?? null,
    isActive: Boolean(row.is_active),
  };
}
