/**
 * Twilio Voice Gather Callback — POST /api/twilio/voice/respond
 *
 * Called by Twilio after caller speaks.
 * 1. Load conversation session
 * 2. Append caller's speech to history
 * 3. Call Claude with business context + history
 * 4. Parse Claude's structured response (speech + intent)
 * 5. Execute intent (book appointment / take message / end call)
 * 6. Save updated session
 * 7. Return TwiML: Say + Gather (or Hangup)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";
import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface VoiceIntent {
  speech: string;
  intent: "continue" | "book_appointment" | "take_message" | "end_call";
  details?: {
    appointment_title?: string;
    appointment_date?: string;   // YYYY-MM-DD
    appointment_time?: string;   // HH:MM (24h)
    message_body?: string;
  };
}

function xml(body: string) {
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}

function endCall(reason: string): Response {
  const twiml = new VoiceResponse();
  twiml.say({ voice: "Polly.Joanna", language: "en-US" }, reason);
  twiml.hangup();
  return xml(twiml.toString());
}

function continueConversation(agentSpeech: string, respondUrl: string): Response {
  const twiml = new VoiceResponse();
  twiml.say({ voice: "Polly.Joanna", language: "en-US" }, agentSpeech);
  const gather = twiml.gather({
    input: ["speech"],
    action: respondUrl,
    method: "POST",
    speechTimeout: "3",
    timeout: 6,
    language: "en-US",
  });
  gather.say({ voice: "Polly.Joanna" }, "");
  twiml.say({ voice: "Polly.Joanna" }, "I'll let you go. Have a great day!");
  twiml.hangup();
  return xml(twiml.toString());
}

export async function POST(request: NextRequest) {
  const formData     = await request.formData();
  const callSid      = formData.get("CallSid")      as string | null;
  const speechResult = formData.get("SpeechResult") as string | null;
  const confidence   = formData.get("Confidence")   as string | null;

  if (!callSid || !speechResult) {
    return endCall("Sorry, I didn't hear anything. Please call back anytime. Goodbye!");
  }

  const supabase = createServiceClient();

  // Load session
  const { data: session } = await supabase
    .from("voice_sessions")
    .select("id, organization_id, from_number, messages")
    .eq("call_sid", callSid)
    .single();

  if (!session) {
    return endCall("I'm having trouble with this call. Please try again later. Goodbye!");
  }

  // Load org context
  const { data: org } = await supabase
    .from("organizations")
    .select("name, entity_type, voice_agent_prompt")
    .eq("id", session.organization_id)
    .single();

  const orgName   = org?.name ?? "this business";
  const orgPrompt = org?.voice_agent_prompt ?? "";

  // Build conversation history
  const history = (session.messages as { role: "user" | "assistant"; content: string }[]) ?? [];
  history.push({ role: "user", content: speechResult });

  const systemPrompt = `You are an AI phone receptionist for ${orgName}. Speak naturally and concisely — this is a live phone call.

${orgPrompt ? `Business info:\n${orgPrompt}\n` : ""}
Your capabilities:
- Answer questions about the business
- Book appointments (ask for preferred date/time, then confirm)
- Take messages to pass to the team
- End the call politely when the caller is done

Rules:
- Keep every response SHORT — 1 to 3 sentences max.
- Never use lists, markdown, or bullet points.
- Only ask ONE question at a time.
- When you need today's date, it is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

ALWAYS respond with valid JSON in this exact format:
{
  "speech": "What you say out loud to the caller",
  "intent": "continue" | "book_appointment" | "take_message" | "end_call",
  "details": {
    "appointment_title": "...",
    "appointment_date": "YYYY-MM-DD",
    "appointment_time": "HH:MM",
    "message_body": "..."
  }
}

Only include "details" when intent is "book_appointment" or "take_message".`;

  let parsed: VoiceIntent;

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 300,
      system: systemPrompt,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });

    const raw = (response.content[0] as { type: string; text: string }).text ?? "{}";
    // Extract JSON (Claude sometimes wraps in ```json)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { speech: "I'll have someone follow up with you shortly.", intent: "end_call" };
  } catch (_) {
    parsed = { speech: "I'm having a bit of trouble right now. Someone from our team will call you back soon.", intent: "end_call" };
  }

  // Append assistant reply to history
  history.push({ role: "assistant", content: parsed.speech });

  // Execute intents
  if (parsed.intent === "book_appointment" && parsed.details?.appointment_title) {
    const startDate = parsed.details.appointment_date ?? new Date().toISOString().slice(0, 10);
    const startTime = parsed.details.appointment_time ?? "09:00";
    const startAt   = `${startDate}T${startTime}:00`;

    const { data: evt } = await supabase
      .from("events")
      .insert({
        organization_id: session.organization_id,
        title: `${parsed.details.appointment_title} — ${session.from_number}`,
        type: "appointment",
        color: "indigo",
        start_at: startAt,
        end_at: null,
        all_day: false,
        completed: false,
      })
      .select("id")
      .single();

    if (evt) {
      await supabase.from("voice_sessions").update({ booked_event_id: evt.id }).eq("call_sid", callSid);
      await createNotificationService(session.organization_id, {
        type: "booking",
        title: "Appointment booked via Voice Agent",
        body: `${parsed.details.appointment_title} on ${parsed.details.appointment_date ?? "TBD"} from ${session.from_number}`,
        link: "/calendar",
      });
    }
  }

  if (parsed.intent === "take_message" && parsed.details?.message_body) {
    await supabase.from("messages").insert({
      organization_id: session.organization_id,
      channel: "sms",
      direction: "inbound",
      from_address: session.from_number,
      to_address: "voice-agent",
      body: `📞 Voicemail message from ${session.from_number}: ${parsed.details.message_body}`,
      read: false,
      sent_at: new Date().toISOString(),
    });
    await createNotificationService(session.organization_id, {
      type: "new_message",
      title: "Message taken via Voice Agent",
      body: parsed.details.message_body.length > 80
        ? parsed.details.message_body.slice(0, 77) + "…"
        : parsed.details.message_body,
      link: "/inbox",
    });
  }

  // Save updated session
  const isEnded = parsed.intent === "end_call";
  await supabase.from("voice_sessions").update({
    messages: history,
    status: isEnded ? "completed" : "active",
    updated_at: new Date().toISOString(),
  }).eq("call_sid", callSid);

  if (parsed.intent === "end_call") {
    return endCall(parsed.speech);
  }

  const respondUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/voice/respond`;
  return continueConversation(parsed.speech, respondUrl);
}
