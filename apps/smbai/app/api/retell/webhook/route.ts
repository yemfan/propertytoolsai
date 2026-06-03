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
import { attributeCallToEmma } from "@/lib/workforce-attribution";

type TranscriptTurn = { role?: string; content?: string };
type Db = ReturnType<typeof createServiceClient>;

/** Spoken-friendly US phone, e.g. "+16267557917" -> "(626) 755-7917". */
function formatPhone(e164: string): string {
  const d = (e164 || "").replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return e164 || "the caller";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Create a follow-up task for the owner after an inbound AI call. Idempotent —
 * skips when a task already references this call (so a re-delivered call_analyzed
 * won't double-task). Best-effort; the caller swallows errors.
 */
async function createInboundFollowUpTask(
  db: Db,
  args: { orgId: string; clientId: string; callId: string; summary: string; fromNumber: string },
): Promise<void> {
  const { data: dup } = await db
    .from("tasks")
    .select("id")
    .eq("organization_id", args.orgId)
    .ilike("notes", `%${args.callId}%`)
    .maybeSingle();
  if (dup) return;

  // Use the contact's name when it isn't the "Caller" placeholder; else the number.
  let who = formatPhone(args.fromNumber);
  const { data: client } = await db
    .from("clients")
    .select("first_name,last_name")
    .eq("id", args.clientId)
    .maybeSingle();
  const fn = (client?.first_name ?? "").trim();
  const ln = (client?.last_name ?? "").trim();
  if (fn && fn.toLowerCase() !== "caller") who = ln ? `${fn} ${ln}` : fn;

  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await db.from("tasks").insert({
    organization_id: args.orgId,
    title: `Follow up: AI call from ${who}`,
    notes: `${args.summary}\n\n(Ref: ${args.callId})`,
    due_date: dueDate,
    client_id: args.clientId,
    priority: "high",
    status: "open",
  });
}

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

    // On analysis of an inbound call, create an owner follow-up task linked to
    // the caller's contact, with the AI call summary in the notes.
    if (event === "call_analyzed" && direction === "inbound" && summary && clientId) {
      try {
        await createInboundFollowUpTask(db, { orgId, clientId, callId, summary, fromNumber });
      } catch (taskErr) {
        console.error("Retell webhook: follow-up task failed", taskErr);
      }
    }

    // Attribute the inbound call to Emma (AI Receptionist): record it as one run and
    // bump calls_answered. Idempotent per call_sid; best-effort (never throws).
    if (event === "call_analyzed" && direction === "inbound") {
      await attributeCallToEmma(db, orgId, {
        callId,
        outcome: { from: fromNumber, ...(summary ? { summary } : {}), ...(durationMs > 0 ? { durationSeconds: Math.round(durationMs / 1000) } : {}) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Retell webhook error:", error);
    // Always 200 so Retell doesn't retry-storm.
    return NextResponse.json({ success: true });
  }
}
