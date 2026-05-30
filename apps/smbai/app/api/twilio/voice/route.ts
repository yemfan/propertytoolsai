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

import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

async function handleRequest(request: NextRequest) {
  let from: string | null = null;
  let to: string | null = null;
  let callSid: string | null = null;

  try {
    if (request.method === "POST") {
      const formData = await request.formData();
      from = formData.get("From") as string | null;
      to = formData.get("To") as string | null;
      callSid = formData.get("CallSid") as string | null;
    } else {
      // GET request — extract from URL params (for health checks)
      const url = new URL(request.url);
      from = url.searchParams.get("From");
      to = url.searchParams.get("To");
      callSid = url.searchParams.get("CallSid");
    }
  } catch {
    // If form parsing fails, return empty response
    return xml("<Response/>");
  }

  if (!from || !to) {
    return xml("<Response/>");
  }

  const supabase = createServiceClient();

  // Find org by Twilio number — must complete before returning response
  // because we need it to decide which TwiML to return
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, auto_reply, auto_reply_msg, voice_agent_enabled, voice_agent_greeting, voice_agent_prompt")
    .eq("twilio_number", to)
    .single();

  // Build response immediately (return quickly to Twilio)
  let twiml: twilio.twiml.VoiceResponse;

  if (org?.voice_agent_enabled) {
    // Voice agent mode
    twiml = new VoiceResponse();
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
  } else {
    // Default passive mode response
    twiml = new VoiceResponse();
    twiml.say({ voice: "Polly.Joanna", language: "en-US" }, "Thanks for calling. We missed you but will be in touch shortly.");
    twiml.hangup();
  }

  // Return response immediately (before background work starts)
  const response = xml(twiml.toString());

  // Run database operations in background so they don't delay the response
  if (org && callSid) {
    after(async () => {
      try {
        // Look up client
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("organization_id", org.id)
          .eq("phone", from)
          .maybeSingle();

        // Log the call
        await supabase.from("calls").insert({
          organization_id: org.id,
          client_id: client?.id ?? null,
          from_number: from,
          to_number: to,
          status: "missed",
          twilio_call_sid: callSid,
          auto_replied: false,
        });

        // Notify the dashboard
        await createNotificationService(org.id, {
          type: "missed_call",
          title: "Missed call",
          body: `From ${from}`,
          link: "/reception",
        });

        // Handle SMS auto-reply if passive mode
        if (!org.voice_agent_enabled && org.auto_reply && org.auto_reply_msg) {
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

        // Create voice session if agent enabled
        if (org.voice_agent_enabled) {
          await supabase.from("voice_sessions").insert({
            organization_id: org.id,
            call_sid: callSid,
            from_number: from,
            to_number: to,
            messages: [],
            status: "active",
          });
        }
      } catch (err) {
        // Silently log background errors (don't block the response)
        console.error("Twilio webhook background task error:", err);
      }
    });
  }

  return response;
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

function xml(body: string) {
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}
