/**
 * Twilio Voice Webhook — POST /api/twilio/voice
 *
 * Configure in Twilio console:
 *   Voice → Phone Number → "A call comes in" → Webhook → https://your-domain/api/twilio/voice
 *
 * Behaviour:
 *  - voice_agent_enabled → start AI conversation loop
 *  - voice_agent_disabled → play brief message + optional SMS auto-reply
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const from    = formData.get("From")    as string | null;
  const to      = formData.get("To")      as string | null;
  const callSid = formData.get("CallSid") as string | null;

  if (!from || !to) {
    return xml("<Response/>");
  }

  const supabase = createServiceClient();

  // Find org by Twilio number
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, auto_reply, auto_reply_msg, voice_agent_enabled, voice_agent_greeting, voice_agent_prompt")
    .eq("twilio_number", to)
    .single();

  // Log call
  if (org && callSid) {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", org.id)
      .eq("phone", from)
      .maybeSingle();

    await supabase.from("calls").insert({
      organization_id: org.id,
      client_id: client?.id ?? null,
      from_number: from,
      to_number: to,
      status: "missed",
      twilio_call_sid: callSid,
      auto_replied: false,
    });

    // Notify the dashboard of the missed call
    await createNotificationService(org.id, {
      type: "missed_call",
      title: "Missed call",
      body: `From ${from}`,
      link: "/reception",
    });

    // ── Voice agent mode ──────────────────────────────────────────────────────
    if (org.voice_agent_enabled) {
      // Create conversation session
      await supabase.from("voice_sessions").insert({
        organization_id: org.id,
        call_sid: callSid,
        from_number: from,
        to_number: to,
        messages: [],
        status: "active",
      });

      const twiml = new VoiceResponse();
      twiml.say({ voice: "Polly.Joanna", language: "en-US" }, org.voice_agent_greeting);
      const gather = twiml.gather({
        input: ["speech"],
        action: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/voice/respond`,
        method: "POST",
        speechTimeout: "3",
        timeout: 6,
        language: "en-US",
      });
      gather.say({ voice: "Polly.Joanna" }, ""); // keeps gather open

      twiml.say({ voice: "Polly.Joanna" }, "I didn't catch that — feel free to call back anytime. Goodbye!");
      twiml.hangup();

      return xml(twiml.toString());
    }

    // ── Passive mode: SMS auto-reply ──────────────────────────────────────────
    if (org.auto_reply && org.auto_reply_msg) {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      try {
        await twilioClient.messages.create({ from: to, to: from, body: org.auto_reply_msg });
        await supabase.from("messages").insert({
          organization_id: org.id,
          channel: "sms",
          direction: "outbound",
          from_address: to,
          to_address: from,
          body: org.auto_reply_msg,
          read: true,
          sent_at: new Date().toISOString(),
        });
        await supabase.from("calls").update({ auto_replied: true, reply_body: org.auto_reply_msg }).eq("twilio_call_sid", callSid);
      } catch (_) { /* SMS failed — call still logged */ }
    }
  }

  // Default: brief message + hangup
  const twiml = new VoiceResponse();
  twiml.say({ voice: "Polly.Joanna", language: "en-US" }, "Thanks for calling. We missed you but will be in touch shortly.");
  twiml.hangup();
  return xml(twiml.toString());
}

function xml(body: string) {
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}
