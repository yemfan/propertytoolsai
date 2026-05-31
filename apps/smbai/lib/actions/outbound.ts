"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { createPhoneCall } from "@/lib/retell";
import {
  loadReceptionistContext,
  buildOutboundDynamicVariables,
  type OutboundPurpose,
} from "@/lib/receptionist-agent";
import { normalizePhoneE164 } from "@/lib/phone";

type CallResult = { ok: true; name: string } | { ok: false; error: string };

/**
 * Place an outbound AI call to a contact. HelmSmart-initiated (the agent dials),
 * which is what makes it distinct from the owner calling someone themselves.
 *
 * Guards (compliance + safety): the contact must have a valid phone, the org
 * must have a connected number, and we only dial 8am–9pm in the business's
 * timezone. The agent discloses it's an AI in its opening line.
 */
export async function callLead(input: {
  clientId: string;
  purpose: OutboundPurpose;
}): Promise<CallResult> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "No organization." };

  const db = createServiceClient();

  const { data: client } = await db
    .from("clients")
    .select("id, first_name, last_name, phone")
    .eq("id", input.clientId)
    .eq("organization_id", orgId)
    .single();
  if (!client) return { ok: false, error: "Contact not found." };
  if (!client.phone) return { ok: false, error: "This contact has no phone number." };

  const toResult = normalizePhoneE164(client.phone);
  if (!toResult.ok) return { ok: false, error: toResult.error };
  const to = toResult.value;

  const agentId = process.env.RETELL_AGENT_ID;
  if (!agentId) return { ok: false, error: "Voice agent is not configured (RETELL_AGENT_ID)." };

  const ctx = await loadReceptionistContext(db, orgId);
  if (!ctx.twilioNumber) {
    return { ok: false, error: "Connect a phone number first in Settings → AI Voice agent." };
  }

  // Calling-hours guard: only 8am–9pm in the business's timezone.
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: ctx.timezone,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const hour = parseInt(hourStr, 10) % 24;
  if (hour < 8 || hour >= 21) {
    return { ok: false, error: "Outside calling hours (8am–9pm local). Try again later." };
  }

  const leadName = `${client.first_name}${client.last_name ? ` ${client.last_name}` : ""}`.trim();
  const dynamicVariables = buildOutboundDynamicVariables(ctx, { leadName, purpose: input.purpose });

  let callId: string;
  try {
    ({ callId } = await createPhoneCall({
      fromNumber: ctx.twilioNumber,
      toNumber: to,
      agentId,
      dynamicVariables,
      metadata: { org_id: orgId, client_id: client.id, purpose: input.purpose },
    }));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Call failed to start." };
  }

  // Log the call so the post-call webhook (matched by call_sid) can fill in the
  // summary/duration, and it shows in the Voice transcript log as outbound.
  await db.from("voice_sessions").insert({
    organization_id: orgId,
    call_sid: callId,
    from_number: ctx.twilioNumber,
    to_number: to,
    direction: "outbound",
    purpose: input.purpose,
    client_id: client.id,
    status: "active",
  });

  return { ok: true, name: leadName || "the contact" };
}
