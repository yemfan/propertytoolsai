import { NextResponse } from "next/server";

import { validateTwilioSignature } from "@/lib/ai-call";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  buildStatusEventRow,
  parseStatusCallback,
} from "@/lib/voice-ai-demo/statusCallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Twilio status webhook for outbound voice-AI demo calls. Twilio POSTs here
 * on every state transition (initiated → ringing → in-progress → completed,
 * or one of the failure terminals). We log each event to `contact_events`
 * so the sales team has a clean timeline of "AI called Sarah; Sarah picked
 * up; call lasted 4m32s."
 *
 * The corresponding `dispatchOutboundDemoCall` sets `statusCallback` to
 * this URL when calling `client.calls.create()`. The contact_id is
 * resolved by joining on `notes->>twilio_call_sid` (set by the demo-request
 * route after a successful dispatch).
 *
 * Always returns 200 to Twilio — failures bubble up to logs but we never
 * make Twilio retry, since duplicate event rows would pollute the timeline.
 */

async function formRecord(req: Request): Promise<Record<string, string>> {
  try {
    const formData = await req.formData();
    return Object.fromEntries(
      Array.from(formData.entries()).map(([k, v]) => [k, String(v)]),
    );
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const formParams = await formRecord(req);

  // Signature validation in production (matches the inbound + outbound-demo
  // routes). Skipped in dev / when explicitly disabled, so curl-based local
  // testing works without Twilio secrets.
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  const url = base ? `${base}${new URL(req.url).pathname}` : "";
  const signature = req.headers.get("x-twilio-signature") || "";
  if (
    process.env.NODE_ENV === "production" &&
    process.env.TWILIO_VALIDATE_WEBHOOK !== "false" &&
    authToken &&
    url
  ) {
    if (!validateTwilioSignature({ authToken, signature, url, formParams })) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const parsed = parseStatusCallback(formParams);
  if (!parsed) {
    // Malformed / missing required fields. Acknowledge to Twilio, log
    // server-side. No event row written.
    console.warn("[voice-ai-demo/status] unparseable callback", formParams);
    return NextResponse.json({ ok: true, written: false, reason: "unparseable" });
  }

  // Resolve the contact_id by the call sid stored in `notes` during dispatch.
  // Best-effort — if no contact matches (e.g. the dispatch path that updated
  // `notes` failed), the audit row still goes in with a null contact_id so
  // call-outcome data isn't lost.
  let contactId: string | null = null;
  try {
    const { data } = await supabaseServer
      .from("contacts")
      .select("id")
      .eq("source", "voice_ai_demo")
      .like("notes", `%${parsed.callSid}%`)
      .limit(1)
      .maybeSingle();
    if (data?.id != null) contactId = String(data.id);
  } catch (e) {
    console.warn("[voice-ai-demo/status] contact lookup failed", e);
  }

  const row = buildStatusEventRow(parsed);
  try {
    await supabaseServer.from("contact_events").insert({
      contact_id: contactId,
      agent_id: null, // demo-request leads carry agent_id=null upstream
      event_type: row.event_type,
      metadata: row.metadata,
      source: row.source,
    } as Record<string, unknown>);
  } catch (e) {
    console.warn("[voice-ai-demo/status] contact_events insert failed", e);
    return NextResponse.json({ ok: true, written: false, reason: "insert_failed" });
  }

  return NextResponse.json({
    ok: true,
    written: true,
    callSid: parsed.callSid,
    status: parsed.status,
    contactId,
  });
}
