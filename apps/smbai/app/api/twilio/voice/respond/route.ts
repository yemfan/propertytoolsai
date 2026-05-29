/**
 * Twilio Voice Gather Callback — POST /api/twilio/voice/respond
 *
 * The AI receptionist's turn handler. Claude drives the call with real tool-use:
 *   check_availability / book_appointment (booking engine) · create_callback
 *   (Task + owner notify) · end_call. The structured brain (hours, appointment
 *   types, knowledge) is in the system prompt; the caller is matched to a client.
 *
 * This is the interim transport (Twilio gather/say). Once a realtime voice
 * platform is wired, it calls these same tools/endpoints.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";
import { getAvailability, bookAppointment, matchOrCreateClient } from "@/lib/booking";
import { describeHours, type BusinessHours, type AppointmentType, type KnowledgeEntry } from "@/lib/receptionist";
import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6"; // fast enough for a live call, reliable tool-use

function xml(body: string) {
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}

function endCall(text: string): Response {
  const t = new VoiceResponse();
  t.say({ voice: "Polly.Joanna", language: "en-US" }, text);
  t.hangup();
  return xml(t.toString());
}

function continueCall(text: string): Response {
  const t = new VoiceResponse();
  t.say({ voice: "Polly.Joanna", language: "en-US" }, text);
  const gather = t.gather({
    input: ["speech"],
    action: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/voice/respond`,
    method: "POST",
    speechTimeout: "3",
    timeout: 6,
    language: "en-US",
  });
  gather.say({ voice: "Polly.Joanna" }, "");
  t.say({ voice: "Polly.Joanna" }, "I'll let you go. Have a great day!");
  t.hangup();
  return xml(t.toString());
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description:
      "Find open appointment slots for an appointment type on a date. ALWAYS call this before offering or booking a time. Returns real openings only — never invent times.",
    input_schema: {
      type: "object",
      properties: {
        appointment_type: { type: "string", description: "The appointment type the caller wants." },
        date: { type: "string", description: "Date to check, formatted YYYY-MM-DD." },
      },
      required: ["appointment_type", "date"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Book a specific open slot. Use only a `start` value returned by check_availability, after confirming the time and the caller's name out loud.",
    input_schema: {
      type: "object",
      properties: {
        appointment_type: { type: "string" },
        start: { type: "string", description: "Exact ISO start time from check_availability." },
        caller_name: { type: "string", description: "The caller's name." },
      },
      required: ["appointment_type", "start", "caller_name"],
    },
  },
  {
    name: "create_callback",
    description:
      "Log a request for the team to call the caller back. Use when you can't answer something or the caller wants a person.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why they want a callback / the message to pass on." },
        caller_name: { type: "string", description: "The caller's name, if given." },
      },
      required: ["reason"],
    },
  },
  {
    name: "end_call",
    description: "End the call politely when the caller is done.",
    input_schema: { type: "object", properties: {} },
  },
];

type ToolCtx = { db: ReturnType<typeof createServiceClient>; orgId: string; fromNumber: string };

async function runTool(
  name: string,
  input: unknown,
  ctx: ToolCtx
): Promise<{ text: string; bookedEventId?: string; bookedNote?: string }> {
  const args = (input ?? {}) as Record<string, unknown>;

  if (name === "check_availability") {
    const date = String(args.date ?? "");
    const type = String(args.appointment_type ?? "");
    const res = await getAvailability(ctx.orgId, type, date);
    if (res.closed) return { text: `Closed on ${date}. Offer a different day within business hours.` };
    if (res.slots.length === 0) return { text: `No open ${res.durationMinutes}-minute slots on ${date}. Suggest another day.` };
    return {
      text:
        `Open slots (offer these to the caller; book with the exact "start"):\n` +
        res.slots.map((s) => `- ${s.label} → start: ${s.startISO}`).join("\n"),
    };
  }

  if (name === "book_appointment") {
    const type = String(args.appointment_type ?? "");
    const start = String(args.start ?? "");
    const callerName = args.caller_name ? String(args.caller_name) : null;
    const clientId = await matchOrCreateClient(ctx.orgId, ctx.fromNumber, callerName);
    const res = await bookAppointment(ctx.orgId, { appointmentTypeName: type, startISO: start, clientId, callerName });
    if (!res.ok) return { text: `Could not book: ${res.reason} Offer to check another time with check_availability.` };
    return {
      text: `Booked: ${res.title} on ${res.label}. Confirm this back to the caller.`,
      bookedEventId: res.eventId,
      bookedNote: `${res.title} on ${res.label} (from ${ctx.fromNumber})`,
    };
  }

  if (name === "create_callback") {
    const reason = String(args.reason ?? "Call back requested");
    const callerName = args.caller_name ? String(args.caller_name) : null;
    const clientId = await matchOrCreateClient(ctx.orgId, ctx.fromNumber, callerName);
    await ctx.db.from("tasks").insert({
      organization_id: ctx.orgId,
      client_id: clientId,
      title: `Call back ${callerName || ctx.fromNumber}`,
      notes: `From ${ctx.fromNumber}: ${reason}`,
      due_date: new Date().toISOString().slice(0, 10),
      priority: "high",
      status: "open",
    });
    await createNotificationService(ctx.orgId, {
      type: "missed_call",
      title: "Call-back requested",
      body: `${callerName || ctx.fromNumber}: ${reason}`.slice(0, 120),
      link: "/tasks",
    });
    return { text: "Let the caller know someone from the team will call them back." };
  }

  return { text: "Done." };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const callSid = formData.get("CallSid") as string | null;
  const speechResult = formData.get("SpeechResult") as string | null;

  if (!callSid || !speechResult) {
    return endCall("Sorry, I didn't catch that. Please call back anytime. Goodbye!");
  }

  const db = createServiceClient();
  const { data: session } = await db
    .from("voice_sessions")
    .select("id, organization_id, from_number, messages")
    .eq("call_sid", callSid)
    .single();
  if (!session) {
    return endCall("I'm having trouble with this call. Please try again later. Goodbye!");
  }

  const orgId = session.organization_id as string;
  const fromNumber = session.from_number as string;

  const [{ data: org }, { data: types }, { data: knowledge }] = await Promise.all([
    db.from("organizations").select("name, voice_agent_prompt, timezone, business_hours").eq("id", orgId).single(),
    db.from("appointment_types").select("name, duration_minutes, description").eq("organization_id", orgId).eq("active", true).order("sort"),
    db.from("knowledge_base").select("title, content").eq("organization_id", orgId).eq("active", true).order("sort"),
  ]);

  const orgName = (org?.name as string) || "this business";
  const timezone = (org?.timezone as string) || "America/New_York";
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayLabel = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric" }).format(new Date());

  const typesText = (types ?? []).length
    ? (types as AppointmentType[]).map((t) => `- ${t.name} (${t.duration_minutes} min)${t.description ? `: ${t.description}` : ""}`).join("\n")
    : "None configured — if asked to book, offer a call-back instead.";
  const knowledgeText = (knowledge ?? []).length
    ? (knowledge as KnowledgeEntry[]).map((k) => `### ${k.title}\n${k.content}`).join("\n\n")
    : "";
  const hoursText = describeHours((org?.business_hours as BusinessHours | null) ?? null);

  const systemPrompt = `You are the AI phone receptionist for ${orgName}. This is a LIVE phone call — speak naturally, keep every reply to 1–3 short sentences, no lists or markdown, and ask only one question at a time.

Today is ${todayLabel} (${todayISO}, timezone ${timezone}). Convert relative dates like "tomorrow" or "next Tuesday" to YYYY-MM-DD yourself.

Business hours:
${hoursText}

Appointment types you can book:
${typesText}

${knowledgeText ? `What you know about ${orgName} — answer ONLY from this (and the notes below):\n${knowledgeText}\n\n` : ""}${org?.voice_agent_prompt ? `Additional notes:\n${org.voice_agent_prompt}\n\n` : ""}How to behave:
- To book: call check_availability first, offer the real open times, confirm the time AND the caller's name, then call book_appointment with the exact start from check_availability. Never invent times.
- If you don't know the answer, do NOT guess — offer a call-back and use create_callback.
- If the caller wants a person, use create_callback.
- When the caller is done, say goodbye and use end_call.`;

  const prior = (session.messages as { role: "user" | "assistant"; content: string }[]) ?? [];
  const messages: Anthropic.MessageParam[] = prior.map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: "user", content: speechResult });

  let speech = "";
  let ended = false;
  let bookedEventId: string | null = null;
  let bookedNote: string | null = null;

  try {
    for (let i = 0; i < 5; i++) {
      const resp = await anthropic.messages.create({ model: MODEL, max_tokens: 400, system: systemPrompt, tools: TOOLS, messages });
      const textPart = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      if (textPart) speech = textPart;

      const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) break;

      messages.push({ role: "assistant", content: resp.content as Anthropic.ContentBlockParam[] });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        if (tu.name === "end_call") {
          ended = true;
          results.push({ type: "tool_result", tool_use_id: tu.id, content: "Call ended." });
          continue;
        }
        const out = await runTool(tu.name, tu.input, { db, orgId, fromNumber });
        if (out.bookedEventId) {
          bookedEventId = out.bookedEventId;
          bookedNote = out.bookedNote ?? null;
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out.text });
      }
      messages.push({ role: "user", content: results });
      if (ended) break;
    }
  } catch (e) {
    console.error("[voice/respond] loop error:", e);
    speech = "I'm having a little trouble right now — let me have someone call you back. Thanks for calling!";
    ended = true;
  }

  if (!speech) speech = ended ? "Thank you for calling. Goodbye!" : "Sorry, could you say that again?";

  const transcript = [...prior, { role: "user", content: speechResult }, { role: "assistant", content: speech }];
  const update: Record<string, unknown> = {
    messages: transcript,
    status: ended ? "completed" : "active",
    updated_at: new Date().toISOString(),
  };
  if (bookedEventId) update.booked_event_id = bookedEventId;
  await db.from("voice_sessions").update(update).eq("call_sid", callSid);

  if (bookedEventId && bookedNote) {
    await createNotificationService(orgId, {
      type: "booking",
      title: "Appointment booked by the receptionist",
      body: bookedNote,
      link: "/calendar",
    });
  }

  return ended ? endCall(speech) : continueCall(speech);
}
