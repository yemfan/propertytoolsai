/**
 * Retell call webhook — POST /api/retell/webhook
 *
 * Retell calls this on call_started / call_ended / call_analyzed with the full
 * call object. We upsert a voice_sessions row keyed by call_sid so every call —
 * inbound or outbound, booking or not — is logged with the caller's number,
 * linked to a contact, and (on analysis) its summary + transcript + recording.
 *
 * Set the agent's Webhook URL to the canonical www host so Retell's POST isn't
 * lost to the apex->www redirect:
 *   https://www.helmsmart.ai/api/retell/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findOrgIdByNumber } from "@/lib/receptionist-agent";
import { matchOrCreateClient } from "@/lib/booking";
import { normalizePhoneE164 } from "@/lib/phone";

type TranscriptTurn = { role?: string; content?: string };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Retell nests the data under `call`; tolerate a flat shape too.
    const call = (body?.call ?? body) as Record<string, unknown>;
    const callId = String(call.call_id ?? call.callId ?? body?.call_id ?? "");
    if (!callId) return NextResponse.json({ success: true });

    const event = String(body?.event ?? "");
    const direction = call.direction === "outbound" ? "outbound" : "inbound";
    const fromNumber = String(call.from_number ?? "");
    const toNumber = String(call.to_number ?? "");
    const dynVars = (call.retell_llm_dynamic_variables ?? {}) as Record<string, string>;
    const analysis = (call.call_analysis ?? {}) as Record<string, unknown>;
    const summary = (analysis.call_summary as string) || (call.summary as string) || null;
    const recordingUrl = (call.recording_url as string) || null;
    const startTs = Number(call.start_timestamp ?? 0);
    const endTs = Number(call.end_timestamp ?? 0);
    const durationMs = Number(call.duration_ms ?? (endTs && startTs ? endTs - startTs : 0));
    const transcriptObj = call.transcript_object as TranscriptTurn[] | undefined;

    const db = createServiceClient();

    // Resolve the org from the call: dynamic var first, else the business number
    // (to_number for inbound, from_number for outbound).
    const businessNumber = direction === "outbound" ? fromNumber : toNumber;
    const orgId = dynVars.org_id || (await findOrgIdByNumber(db, businessNumber));
    if (!orgId) return NextResponse.json({ success: true });

    // Link the caller to a contact. Inbound: the caller (from_number). Outbound is
    // already linked at creation, so we don't overwrite it here.
    let clientId: string | null = null;
    if (direction === "inbound" && fromNumber) {
      const caller = normalizePhoneE164(fromNumber);
      if (caller.ok) clientId = await matchOrCreateClient(orgId, caller.value);
    }

    const row: Record<string, unknown> = {
      organization_id: orgId,
      call_sid: callId,
      from_number: fromNumber || "unknown",
      to_number: toNumber || "unknown",
      direction,
      status: event === "call_started" ? "active" : "completed",
    };
    if (summary) row.summary = summary;
    if (recordingUrl) row.recording_url = recordingUrl;
    if (durationMs > 0) row.duration_seconds = Math.round(durationMs / 1000);
    if (clientId) row.client_id = clientId;
    if (Array.isArray(transcriptObj) && transcriptObj.length) {
      row.messages = transcriptObj.map((t) => ({
        role: t.role === "user" ? "user" : "assistant",
        content: String(t.content ?? ""),
      }));
    }

    await db.from("voice_sessions").upsert(row, { onConflict: "call_sid" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Retell webhook error:", error);
    // Always 200 so Retell doesn't retry-storm.
    return NextResponse.json({ success: true });
  }
}
