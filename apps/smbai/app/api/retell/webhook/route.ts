/**
 * Retell call-lifecycle webhook — POST /api/retell/webhook
 *
 * Receives call_started / call_ended / call_analyzed and persists each call to
 * voice_sessions, so Retell calls show in the Voice Agent log next to interim
 * calls. call_analyzed carries Retell's own transcript + summary — we store both.
 *
 * Verified via the X-Retell-Signature HMAC (secret = RETELL_API_KEY). Note the
 * SDK's verify() is async. Set the agent's webhook_url to:
 *   https://<app>/api/retell/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { findOrgIdByNumber } from "@/lib/receptionist-agent";

type Utterance = { role?: string; content?: string };

/** Retell's transcript_object → our {role, content}[] (agent → assistant). */
function toMessages(call: Record<string, unknown>): { role: string; content: string }[] {
  const obj = call.transcript_object;
  if (Array.isArray(obj) && obj.length) {
    return (obj as Utterance[])
      .map((u) => ({ role: u.role === "agent" ? "assistant" : "user", content: String(u.content ?? "") }))
      .filter((m) => m.content.trim());
  }
  const flat = typeof call.transcript === "string" ? (call.transcript as string).trim() : "";
  return flat ? [{ role: "assistant", content: flat }] : [];
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  const apiKey = process.env.RETELL_API_KEY;
  if (apiKey) {
    const sig = req.headers.get("x-retell-signature") ?? "";
    const ok = await Retell.verify(raw, apiKey, sig);
    if (!ok) return new NextResponse("invalid signature", { status: 401 });
  }

  let event = "";
  let call: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw);
    event = String(parsed?.event ?? "");
    call = (parsed?.call ?? {}) as Record<string, unknown>;
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  const callId = String(call.call_id ?? "");
  if (!callId) return new NextResponse(null, { status: 204 });

  const db = createServiceClient();
  const fromNumber = String(call.from_number ?? "");
  const toNumber = String(call.to_number ?? "");
  const dynVars = (call.retell_llm_dynamic_variables ?? {}) as Record<string, string>;
  const orgId = dynVars.org_id || (await findOrgIdByNumber(db, toNumber));
  if (!orgId) return new NextResponse(null, { status: 204 });

  if (event === "call_started") {
    await db.from("voice_sessions").upsert(
      {
        organization_id: orgId,
        call_sid: callId,
        from_number: fromNumber || "unknown",
        to_number: toNumber || "unknown",
        status: "active",
      },
      { onConflict: "call_sid" }
    );
  } else if (event === "call_ended" || event === "call_analyzed") {
    const analysis = (call.call_analysis ?? {}) as Record<string, unknown>;
    const summary = typeof analysis.call_summary === "string" ? (analysis.call_summary as string).trim() : "";
    const durationMs = typeof call.duration_ms === "number" ? (call.duration_ms as number) : null;
    const recordingUrl = typeof call.recording_url === "string" ? (call.recording_url as string) : null;
    const update: Record<string, unknown> = {
      organization_id: orgId,
      call_sid: callId,
      from_number: fromNumber || "unknown",
      to_number: toNumber || "unknown",
      messages: toMessages(call),
      status: "completed",
      updated_at: new Date().toISOString(),
    };
    if (summary) update.summary = summary;
    if (durationMs !== null) update.duration_seconds = Math.round(durationMs / 1000);
    if (recordingUrl) update.recording_url = recordingUrl;
    await db.from("voice_sessions").upsert(update, { onConflict: "call_sid" });
  }

  return new NextResponse(null, { status: 204 });
}
