import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateTwilioSignature } from "@/lib/ai-call/twilio";
import { parseTwilioStatusCallback } from "@/lib/voice/statusCallback";

/**
 * Twilio Voice status-callback receiver.
 *
 * Wired up by clickToCall.server.ts on outbound calls. Twilio POSTs
 * x-www-form-urlencoded payloads as the call progresses through
 * `initiated → ringing → answered → completed`. We:
 *   1. Verify Twilio's HMAC signature
 *   2. Parse the form body
 *   3. Update lead_calls.status + duration
 *   4. Append a row to lead_call_events for the timeline
 *
 * Returns 200 even on unrecognized payloads so Twilio doesn't retry
 * for hours on a malformed request. 401 only when the signature is
 * actually invalid.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const formParams = parseFormBody(rawBody);

  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const h = await headers();
  const signature = h.get("x-twilio-signature") ?? "";
  const url = req.url;

  // Verify only when we have a signing secret. Local dev / test
  // environments without TWILIO_AUTH_TOKEN skip the check (and won't
  // receive real Twilio traffic anyway).
  if (authToken) {
    const ok = validateTwilioSignature({
      authToken,
      signature,
      url,
      formParams,
    });
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "invalid signature" },
        { status: 401 },
      );
    }
  }

  const update = parseTwilioStatusCallback(formParams);
  if (!update) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Locate the lead_calls row by Twilio CallSid. Outbound calls
  // were inserted by clickToCall.server.ts.
  const { data: row, error: lookupErr } = await supabaseAdmin
    .from("lead_calls")
    .select("id")
    .eq("twilio_call_sid", update.callSid)
    .maybeSingle();

  if (lookupErr || !row) {
    // Unknown SID — likely a race (status callback arriving before
    // we finished patching the row's SID) or a callback for an
    // inbound call this route doesn't own. 200 + skip.
    return NextResponse.json({ ok: true, unknown_sid: true });
  }

  const callId = String((row as { id: string }).id);
  const patch: Record<string, unknown> = {
    status: update.status,
  };
  if (update.durationSeconds != null) {
    patch.duration_seconds = update.durationSeconds;
  }
  if (update.status === "in_progress") {
    patch.started_at = new Date().toISOString();
  }
  if (update.status === "completed" || update.status === "missed" || update.status === "failed") {
    patch.ended_at = new Date().toISOString();
  }

  await supabaseAdmin.from("lead_calls").update(patch).eq("id", callId);

  // Append to the timeline. Idempotent dedup isn't strictly needed —
  // Twilio sends each status once per call by default, and the
  // append-only model means a duplicate is harmless.
  await supabaseAdmin.from("lead_call_events").insert({
    call_id: callId,
    event_type: `status:${update.status}`,
    payload: update.raw,
  });

  return NextResponse.json({ ok: true, status: update.status });
}

function parseFormBody(raw: string): Record<string, string> {
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}
