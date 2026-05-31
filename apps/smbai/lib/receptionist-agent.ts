import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";
import { getAvailability, bookAppointment, matchOrCreateClient } from "@/lib/booking";
import { describeHours, type BusinessHours, type AppointmentType, type KnowledgeEntry } from "@/lib/receptionist";
import twilio from "twilio";

/**
 * The receptionist's shared brain — transport-agnostic.
 *
 * Both the interim Twilio gather/say loop and the realtime Retell platform run
 * the SAME context, prompt, tools and booking side-effects through this module.
 * The transport layer (TwiML, or Retell's HTTP function calls) is thin wiring on
 * top; the behaviour lives here so the two paths never drift.
 */

type ServiceClient = ReturnType<typeof createServiceClient>;

// ─── Per-org context ────────────────────────────────────────────────────────────

export type ReceptionistContext = {
  orgId: string;
  orgName: string;
  twilioNumber: string | null;
  timezone: string;
  todayISO: string;
  todayLabel: string;
  hoursText: string;
  typesText: string;
  knowledgeText: string;
  extraNotes: string;
};

/** Load the structured brain (hours, appointment types, knowledge) for an org. */
export async function loadReceptionistContext(db: ServiceClient, orgId: string): Promise<ReceptionistContext> {
  const [{ data: org }, { data: types }, { data: knowledge }] = await Promise.all([
    db.from("organizations").select("name, twilio_number, voice_agent_prompt, timezone, business_hours").eq("id", orgId).single(),
    db.from("appointment_types").select("name, duration_minutes, description").eq("organization_id", orgId).eq("active", true).order("sort"),
    db.from("knowledge_base").select("title, content").eq("organization_id", orgId).eq("active", true).order("sort"),
  ]);

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

  return {
    orgId,
    orgName: (org?.name as string) || "this business",
    twilioNumber: (org?.twilio_number as string | null) ?? null,
    timezone,
    todayISO,
    todayLabel,
    hoursText,
    typesText,
    knowledgeText,
    extraNotes: (org?.voice_agent_prompt as string) || "",
  };
}

/** Resolve an org by the dialed (business) phone number.
 *
 * Tries an exact match first, then falls back to matching on the last 10 digits
 * so differences in formatting (+1 prefix, spaces, dashes) never silently break
 * booking — a phone-format mismatch used to make the agent say it couldn't reach
 * the booking system. */
export async function findOrgIdByNumber(db: ServiceClient, toNumber: string): Promise<string | null> {
  if (!toNumber) return null;

  const { data } = await db.from("organizations").select("id").eq("twilio_number", toNumber).maybeSingle();
  if (data?.id) return data.id as string;

  // Fallback: normalize to the last 10 digits and suffix-match.
  const last10 = toNumber.replace(/\D/g, "").slice(-10);
  if (last10.length === 10) {
    const { data: rows } = await db
      .from("organizations")
      .select("id")
      .ilike("twilio_number", `%${last10}`)
      .limit(1);
    if (rows?.[0]?.id) return rows[0].id as string;
  }

  return null;
}

// ─── Prompt (interim Anthropic loop) ──────────────────────────────────────────────

/** The exact system prompt for the interim Twilio gather/say loop. */
export function buildVoiceSystemPrompt(ctx: ReceptionistContext): string {
  return `You are the AI phone receptionist for ${ctx.orgName}. This is a LIVE phone call — speak naturally, keep every reply to 1–3 short sentences, no lists or markdown, and ask only one question at a time.

Today is ${ctx.todayLabel} (${ctx.todayISO}, timezone ${ctx.timezone}). Convert relative dates like "tomorrow" or "next Tuesday" to YYYY-MM-DD yourself.

Business hours:
${ctx.hoursText}

Appointment types you can book:
${ctx.typesText}

${ctx.knowledgeText ? `What you know about ${ctx.orgName} — answer ONLY from this (and the notes below):\n${ctx.knowledgeText}\n\n` : ""}${ctx.extraNotes ? `Additional notes:\n${ctx.extraNotes}\n\n` : ""}How to behave:
- To book: call check_availability first, offer the real open times, confirm the time AND the caller's name, then call book_appointment with the exact start from check_availability. Never invent times.
- If you don't know the answer, do NOT guess — offer a call-back and use create_callback.
- If the caller wants a person, use create_callback.
- When the caller is done, say goodbye and use end_call.`;
}

// ─── Dynamic variables (Retell) ───────────────────────────────────────────────────

/**
 * Per-call dynamic variables for the Retell agent. Retell requires string→string;
 * keys are referenced as {{key}} in RETELL_AGENT_PROMPT_TEMPLATE. `org_id` lets the
 * function/webhook endpoints resolve the tenant without a second lookup.
 */
export function buildReceptionistDynamicVariables(ctx: ReceptionistContext): Record<string, string> {
  return {
    org_id: ctx.orgId,
    business_name: ctx.orgName,
    business_hours: ctx.hoursText,
    appointment_types: ctx.typesText,
    knowledge: ctx.knowledgeText || "(no knowledge base provided — take a message instead of guessing)",
    extra_notes: ctx.extraNotes || "(none)",
    timezone: ctx.timezone,
    today: ctx.todayISO,
    today_label: ctx.todayLabel,
  };
}

/**
 * The prompt to paste into the Retell agent (single-prompt mode). It mirrors the
 * interim prompt but uses Retell {{dynamic_variables}} and Retell's built-in
 * end_call tool. check_availability / book_appointment / create_callback are
 * custom functions pointed at /api/retell/function.
 */
export const RETELL_AGENT_PROMPT_TEMPLATE = `You are the AI phone receptionist for {{business_name}}. This is a LIVE phone call — speak naturally, keep every reply to 1–3 short sentences, no lists, and ask only one question at a time.

Today is {{today_label}} ({{today}}, timezone {{timezone}}). Convert relative dates like "tomorrow" or "next Tuesday" to YYYY-MM-DD yourself.

Business hours:
{{business_hours}}

Appointment types you can book:
{{appointment_types}}

What you know about {{business_name}} — answer ONLY from this:
{{knowledge}}

Additional notes:
{{extra_notes}}

How to behave:
- To book: call check_availability first, offer the real open times, confirm the time AND the caller's name, then call book_appointment with the exact start from check_availability. Never invent times.
- If you don't know the answer, do NOT guess — offer a call-back and use create_callback.
- If the caller wants a person, use create_callback.
- When the caller is done, say goodbye and end the call.`;

// ─── Tools ────────────────────────────────────────────────────────────────────────

export type ToolResult = { text: string; bookedEventId?: string; bookedNote?: string; bookedLabel?: string };
export type ToolCtx = { db: ServiceClient; orgId: string; fromNumber: string };

/** Execute one receptionist tool. Returns a natural-language result for the LLM. */
export async function runReceptionistTool(name: string, input: unknown, ctx: ToolCtx): Promise<ToolResult> {
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
      bookedLabel: res.label,
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

// ─── Booking side-effects (shared by both transports) ─────────────────────────────

/**
 * On a successful booking: notify the owner and text the caller a confirmation
 * (logged to the inbox). Best-effort — wrapped so a failed SMS never breaks the
 * call. Intended to be invoked from a route's `after()` so it never adds latency.
 */
export async function notifyBooking(
  db: ServiceClient,
  org: { orgId: string; orgName: string; twilioNumber: string | null },
  callerNumber: string,
  booked: { bookedNote?: string | null; bookedLabel?: string | null }
): Promise<void> {
  if (!booked.bookedNote) return;

  await createNotificationService(org.orgId, {
    type: "booking",
    title: "Appointment booked by the receptionist",
    body: booked.bookedNote,
    link: "/calendar",
  });

  if (org.twilioNumber && booked.bookedLabel && callerNumber) {
    try {
      const body = `You're confirmed for ${booked.bookedLabel}. See you then! — ${org.orgName}`;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const sms = await client.messages.create({ from: org.twilioNumber, to: callerNumber, body });
      const clientId = await matchOrCreateClient(org.orgId, callerNumber);
      await db.from("messages").insert({
        organization_id: org.orgId,
        client_id: clientId,
        channel: "sms",
        direction: "outbound",
        from_address: org.twilioNumber,
        to_address: callerNumber,
        body,
        read: true,
        external_id: sms.sid,
        sent_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[receptionist] confirmation SMS error:", e);
    }
  }
}
