import "server-only";

import twilio from "twilio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getAgentForwardingInfo,
  toE164,
  toUsDisplayPhone,
} from "@/lib/missed-call/service";

/**
 * Power Dialer / Click-to-Call service.
 *
 * Pattern:
 *   - Agent clicks "Call" on a contact in the CRM.
 *   - Server creates a Twilio outbound call to the AGENT'S phone first.
 *   - When the agent picks up, Twilio fetches the connect-twiml URL,
 *     which returns a `<Dial>` to the LEAD'S phone — bridging them.
 *   - Caller ID on the bridged leg is the agent's Twilio number, so
 *     the lead sees the agent's CRM number, not their personal cell.
 *   - The status callback on the parent call writes to call_logs as
 *     the call progresses (queued → ringing → in-progress → completed).
 *   - Optional recording: when enabled, the bridged leg is recorded;
 *     the recording URL is written to call_logs.recording_url when the
 *     recording is ready (recording status callback).
 *
 * Why agent-first dial vs. lead-first?
 *   - The agent has explicitly requested the call by clicking Call.
 *     Calling them first ensures they're ready when the lead picks up
 *     (no awkward silence, no robocall feel).
 *   - It's the kvCORE / FUB convention agents are already used to.
 *
 * Trust boundary:
 *   - The CRM session validates the agent is allowed to call this
 *     contact (ownership). The Twilio API call uses the platform's
 *     account credentials.
 */

export type StartCallResult =
  | {
      ok: true;
      callLogId: string;
      twilioCallSid: string;
      message: string;
    }
  | {
      ok: false;
      code: string;
      error: string;
      status?: number;
    };

export async function startClickToCall(args: {
  agentId: string;
  contactId: string;
  /** When true, record the bridged conversation. */
  record?: boolean;
}): Promise<StartCallResult> {
  const { agentId, contactId, record } = args;

  // 1. Resolve the agent's forwarding phone (where we ring first).
  const agentInfo = await getAgentForwardingInfo(agentId);
  const agentE164 = toE164(agentInfo?.forwarding_phone ?? null);
  if (!agentE164) {
    return {
      ok: false,
      code: "no_forwarding_phone",
      error:
        "Add your personal mobile number in Settings → Missed Call Text-Back before using click-to-call.",
      status: 400,
    };
  }

  // 2. Resolve the contact's phone, ownership-checked.
  const { data: contactRow } = await supabaseAdmin
    .from("contacts")
    .select("id, phone, phone_number, agent_id, name, first_name, last_name")
    .eq("id", contactId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!contactRow) {
    return {
      ok: false,
      code: "contact_not_found",
      error: "Contact not found.",
      status: 404,
    };
  }
  type ContactRow = {
    phone: string | null;
    phone_number: string | null;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
  };
  const c = contactRow as ContactRow;
  const contactPhoneRaw = c.phone_number ?? c.phone ?? "";
  const contactE164 = toE164(contactPhoneRaw);
  if (!contactE164) {
    return {
      ok: false,
      code: "no_contact_phone",
      error: "This contact doesn't have a valid phone number on file.",
      status: 400,
    };
  }

  // 3. Twilio config check.
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber =
    process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    return {
      ok: false,
      code: "twilio_unconfigured",
      error: "Twilio voice is not configured on this environment.",
      status: 503,
    };
  }
  const fromE164 = toE164(fromNumber);
  if (!fromE164) {
    return {
      ok: false,
      code: "twilio_misconfigured",
      error: "TWILIO_PHONE_NUMBER is not a valid US E.164 number.",
      status: 503,
    };
  }

  // 4. Pre-create the call_logs row so the URLs we hand to Twilio
  // can reference our log id directly (no race against the
  // status-callback firing before our insert lands).
  const { data: logRow, error: logErr } = await supabaseAdmin
    .from("call_logs")
    .insert({
      agent_id: agentId,
      contact_id: contactId,
      direction: "outbound",
      status: "queued",
      from_phone: fromE164,
      to_phone: contactE164,
      notes: "Click-to-call initiated.",
    })
    .select("id")
    .single();
  if (logErr || !logRow) {
    console.error("[power-dialer] pre-insert call_logs:", logErr?.message);
    return {
      ok: false,
      code: "log_insert_failed",
      error: logErr?.message ?? "Could not write call log.",
      status: 500,
    };
  }
  const callLogId = (logRow as { id: string }).id;

  // 5. Build the URLs Twilio will call.
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (!base) {
    return {
      ok: false,
      code: "missing_app_base_url",
      error: "APP_BASE_URL is not set; cannot build Twilio webhook URLs.",
      status: 503,
    };
  }
  const connectUrl = `${base}/api/twilio/voice/click-to-call/connect?logId=${encodeURIComponent(
    callLogId,
  )}&toE164=${encodeURIComponent(contactE164)}${record ? "&record=1" : ""}`;
  const statusCallbackUrl = `${base}/api/twilio/voice/click-to-call/status?logId=${encodeURIComponent(
    callLogId,
  )}`;

  // 6. Place the call: Twilio dials the AGENT first. When agent
  // picks up, Twilio fetches connectUrl which returns <Dial> to
  // bridge the lead.
  try {
    const client = twilio(accountSid, authToken);
    const call = await client.calls.create({
      to: agentE164,
      from: fromE164,
      url: connectUrl,
      method: "POST",
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      // 30s for the agent to pick up before Twilio gives up.
      timeout: 30,
    });

    // Update the row with the Twilio SID so the status callback can
    // find it (the status callback also includes logId in the
    // querystring — belt and braces).
    await supabaseAdmin
      .from("call_logs")
      .update({ twilio_call_sid: call.sid })
      .eq("id", callLogId);

    return {
      ok: true,
      callLogId,
      twilioCallSid: call.sid,
      message:
        "Calling your phone now. When you pick up, we'll bridge to the lead.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Twilio API error";
    console.error("[power-dialer] calls.create:", msg);
    await supabaseAdmin
      .from("call_logs")
      .update({ status: "failed", notes: `Twilio: ${msg}` })
      .eq("id", callLogId);
    return {
      ok: false,
      code: "twilio_error",
      error: msg,
      status: 502,
    };
  }
}

// Re-export for convenience so callers don't need both imports.
export { toUsDisplayPhone };
