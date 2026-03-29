import twilio from "twilio";
import { supabaseAdmin } from "@/lib/supabase/admin";

function digitsOnly(input: string) {
  return input.replace(/\D/g, "");
}

/** Accepts E.164 or US 10-digit; returns E.164 +1... or null */
export function normalizeToE164(input: string): string | null {
  const d = digitsOnly(input);
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  const last10 = d.slice(-10);
  if (last10.length === 10) return `+1${last10}`;
  return null;
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Missing Twilio credentials");
  return twilio(sid, token);
}

function fromNumber() {
  return (
    process.env.TWILIO_SMS_FROM_NUMBER?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim() ||
    process.env.TWILIO_FROM_NUMBER?.trim() ||
    ""
  );
}

function statusCallbackUrl() {
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (!base) return undefined;
  return `${base}/api/twilio/sms/status`;
}

export async function sendOutboundSms(params: {
  leadId: string;
  to: string;
  body: string;
  agentId?: string | null;
  actorType?: "agent" | "system" | "ai";
  actorName?: string | null;
}) {
  const client = getTwilioClient();
  const from = fromNumber();
  if (!from) {
    throw new Error("Missing TWILIO_SMS_FROM_NUMBER or TWILIO_PHONE_NUMBER / TWILIO_FROM_NUMBER");
  }

  const toE164 = normalizeToE164(params.to);
  if (!toE164) {
    throw new Error("Invalid phone number; use E.164 or 10-digit US");
  }

  const message = await client.messages.create({
    to: toE164,
    from,
    body: params.body,
    statusCallback: statusCallbackUrl(),
  });

  const sid = String(message.sid ?? "");
  const status = String(message.status ?? "queued");

  const { error: smsErr } = await supabaseAdmin.from("sms_messages").insert({
    lead_id: params.leadId,
    agent_id: params.agentId ?? null,
    message: params.body,
    direction: "outbound",
    external_message_id: sid || null,
    twilio_status: status,
  } as Record<string, unknown>);

  if (smsErr) throw smsErr;

  try {
    await supabaseAdmin.from("message_logs").insert({
      lead_id: params.leadId,
      type: "sms",
      status: "sent",
      content: params.body,
    } as Record<string, unknown>);
  } catch {
    // non-fatal
  }

  try {
    await supabaseAdmin.rpc("log_lead_event", {
      p_lead_id: params.leadId,
      p_event_type: "sms_sent",
      p_metadata: {
        to: toE164,
        twilioSid: sid,
        twilioStatus: status,
        actorType: params.actorType ?? "system",
        actorName: params.actorName ?? null,
      },
    });
  } catch {
    // optional timeline
  }

  try {
    await supabaseAdmin
      .from("leads")
      .update({ sms_last_outbound_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("id", params.leadId);
  } catch {
    // optional column
  }

  return {
    sid,
    status,
    to: toE164,
  };
}
