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
  orgNameZh: string;
  agentName: string;
  twilioNumber: string | null;
  timezone: string;
  todayISO: string;
  todayLabel: string;
  hoursText: string;
  typesText: string;
  knowledgeText: string;
  extraNotes: string;
  greeting: string;
};

/** Load the structured brain (hours, appointment types, knowledge) for an org. */
export async function loadReceptionistContext(db: ServiceClient, orgId: string): Promise<ReceptionistContext> {
  const [{ data: org }, { data: types }, { data: knowledge }] = await Promise.all([
    db.from("organizations").select("name, twilio_number, voice_agent_prompt, voice_agent_greeting, voice_agent_name, voice_agent_business_name, voice_agent_business_name_zh, timezone, business_hours").eq("id", orgId).single(),
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

  // The business name the agent SAYS — a per-business override (brand/DBA) that
  // falls back to the legal org name. The Chinese name is used when the agent
  // speaks Chinese, falling back to the English/display name. (The legal name
  // stays in Settings for invoices, etc.)
  const displayName = (org?.voice_agent_business_name as string)?.trim() || (org?.name as string) || "this business";
  const displayNameZh = (org?.voice_agent_business_name_zh as string)?.trim() || displayName;

  return {
    orgId,
    orgName: displayName,
    orgNameZh: displayNameZh,
    agentName: ((org?.voice_agent_name as string) || "").trim(),
    twilioNumber: (org?.twilio_number as string | null) ?? null,
    timezone,
    todayISO,
    todayLabel,
    hoursText,
    typesText,
    knowledgeText,
    extraNotes: (org?.voice_agent_prompt as string) || "",
    greeting: (org?.voice_agent_greeting as string) || "",
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

// ─── System prompt (per-business, HelmSmart-owned) ────────────────────────────────

/** Resolve {{agent_name}} / {{business_name}} placeholders a business may use in
 *  their greeting or business-context text. Done server-side because Retell does
 *  not recursively expand placeholders nested inside a dynamic variable. */
function fillPlaceholders(text: string, ctx: ReceptionistContext): string {
  return (text || "")
    .replace(/\{\{\s*agent_name\s*\}\}/gi, ctx.agentName.trim())
    .replace(/\{\{\s*business_name_zh\s*\}\}/gi, ctx.orgNameZh)
    .replace(/\{\{\s*business_name\s*\}\}/gi, ctx.orgName);
}

/**
 * The full per-business system prompt, assembled from the org's brain (hours,
 * services, knowledge base, business context) plus the standard receptionist
 * behaviour. This is the single source of truth and is OWNED by HelmSmart, not
 * Retell: it's injected into the shared Retell agent as the {{system_prompt}}
 * dynamic variable (Retell's prompt is just "{{system_prompt}}"), so every
 * business is configured entirely from their HelmSmart dashboard and a change to
 * the booking behaviour here reaches all businesses without touching Retell.
 */
export function buildSystemPrompt(ctx: ReceptionistContext): string {
  return `## Languages
Your opening greeting has ALREADY been played to the caller automatically. Do NOT greet again, do NOT re-introduce yourself, and do NOT repeat the business name — just respond to what the caller says. Speak in whichever language the caller uses, and switch the moment they switch. Never ask which language they prefer.${ctx.orgNameZh !== ctx.orgName ? ` When you speak Chinese, call the business "${ctx.orgNameZh}"; in English call it "${ctx.orgName}".` : ""}

You are ${ctx.agentName ? `${ctx.agentName}, ` : ""}the AI phone receptionist for ${ctx.orgName}. This is a LIVE phone call — speak naturally, keep every reply to 1–3 short sentences, no lists or markdown, and ask only one question at a time.${ctx.agentName ? ` If the caller asks your name, you're ${ctx.agentName}.` : ""}

Today is ${ctx.todayLabel} (${ctx.todayISO}, timezone ${ctx.timezone}). Convert relative dates like "tomorrow" or "next Tuesday" to YYYY-MM-DD yourself.

Business hours:
${ctx.hoursText}

Appointment types you can book:
${ctx.typesText}

What you know about ${ctx.orgName} — answer the caller's questions ONLY from this:
${ctx.knowledgeText || "(no knowledge base yet — if you don't know the answer, take a message instead of guessing)"}

About the business:
${fillPlaceholders(ctx.extraNotes, ctx) || "(none)"}

How to behave:
- If the caller has an EMERGENCY: do not book an appointment. Take their name and phone number, tell them "I'll have someone call you right back," and use create_callback noting that it is an emergency.
- To book: call check_availability first, offer the real open times, confirm the time AND the caller's name, then call book_appointment. Always pass the date as YYYY-MM-DD and the time in Western digits (e.g. 11:00 AM), even when the conversation is in another language. Never invent times.
- Say dates and times in the CALLER'S language. The tools return them in English (e.g. "Monday, June 2 at 11 AM") — translate them when you speak: to a Chinese caller say "6月2号星期一上午11点". Never mix English words into a Chinese sentence.
- Answer the caller's questions about ${ctx.orgName} using the info above. If you don't know, do NOT guess — offer a call-back with create_callback.
- If the caller wants a person, use create_callback.
- Before you end the call, always ask if there's anything else you can help with, and WAIT for their answer. Only end after they confirm they're all set — never hang up right after answering or while they might still be speaking. Then give a warm goodbye and end the call.`;
}

/** @deprecated Use buildSystemPrompt. Kept for the interim Twilio gather/say loop. */
export function buildVoiceSystemPrompt(ctx: ReceptionistContext): string {
  return buildSystemPrompt(ctx);
}

// ─── Dynamic variables (Retell) ───────────────────────────────────────────────────

/**
 * Per-call dynamic variables for the Retell agent. Retell requires string→string;
 * keys are referenced as {{key}} in RETELL_AGENT_PROMPT_TEMPLATE. `org_id` lets the
 * function/webhook endpoints resolve the tenant without a second lookup.
 */
export function buildReceptionistDynamicVariables(ctx: ReceptionistContext): Record<string, string> {
  // Greeting comes from the org's "Opening greeting" field. Resolve the
  // {{agent_name}} / {{business_name}} placeholders HERE (server-side): Retell
  // sets its Welcome Message to {{greeting}} and does NOT recursively expand
  // placeholders nested inside a dynamic variable, so they must be resolved
  // before we hand the greeting over. Auto-prepend the business name only if the
  // resolved greeting doesn't already name it.
  const g = fillPlaceholders(ctx.greeting || "Hello! Thank you for calling. How can I help you today?", ctx)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const greeting = g.includes(ctx.orgName) ? g : `${ctx.orgName}. ${g}`;

  return {
    org_id: ctx.orgId,
    greeting,
    business_name: ctx.orgName,
    business_name_zh: ctx.orgNameZh,
    agent_name: ctx.agentName,
    business_hours: ctx.hoursText,
    appointment_types: ctx.typesText,
    knowledge: ctx.knowledgeText || "(no knowledge base provided — take a message instead of guessing)",
    extra_notes: ctx.extraNotes || "(none)",
    timezone: ctx.timezone,
    today: ctx.todayISO,
    today_label: ctx.todayLabel,
    // Full per-business prompt — the Retell agent's prompt is just "{{system_prompt}}".
    system_prompt: buildSystemPrompt(ctx),
  };
}

// ─── Outbound calls (HelmSmart-initiated) ─────────────────────────────────────────

/** What an outbound AI call is trying to accomplish. */
export type OutboundPurpose = "follow_up" | "appointment_reminder";

/** First line the AI speaks when the lead answers — bilingual (English + Chinese),
 *  disclosing it's an AI in both (compliance). The agent then continues in
 *  whichever language the contact replies in. */
export function buildOutboundGreeting(ctx: ReceptionistContext, leadName: string): string {
  const lead = leadName.trim();
  const who = ctx.agentName || "an assistant";
  const en = `Hi${lead ? ` ${lead}` : " there"}, this is ${who}, an AI assistant calling on behalf of ${ctx.orgName}. Is now a quick okay time to talk?`;
  const zh = `您好${lead}，我是${ctx.orgNameZh}的AI助理${ctx.agentName || ""}，请问现在方便讲几句话吗？`;
  return `${en} ${zh}`;
}

/** Per-purpose system prompt for an outbound call. Reuses the business's hours,
 *  services, and knowledge, reframed as a call the agent initiated. */
export function buildOutboundSystemPrompt(
  ctx: ReceptionistContext,
  opts: { leadName: string; purpose: OutboundPurpose; detail?: string }
): string {
  const lead = opts.leadName.trim() || "the customer";
  const appt = opts.detail ? ` Their appointment is on ${opts.detail}.` : "";
  const goal =
    opts.purpose === "appointment_reminder"
      ? `Your goal: remind ${lead} about their upcoming appointment with ${ctx.orgName} and confirm they can still make it.${appt} If they want to reschedule, use check_availability then book_appointment for a new time. If they want to cancel or need a person, use create_callback.`
      : `Your goal: follow up with ${lead} about their interest in ${ctx.orgName}. Re-engage warmly, answer their questions, and if there is interest, book a meeting with book_appointment. If they are not interested, thank them politely and end the call.`;

  return `## Outbound call — YOU placed this call
You are ${ctx.agentName ? `${ctx.agentName}, ` : ""}an AI assistant calling on behalf of ${ctx.orgName}. This is a LIVE outbound call that you initiated, and your opening line already greeted them and disclosed that you are an AI.

After they respond, first make sure it is a good time. If it is a bad time, apologize, offer to call back later with create_callback, and end the call. Never be pushy and never repeat yourself.

${goal}

Today is ${ctx.todayLabel} (${ctx.todayISO}, timezone ${ctx.timezone}). Convert relative dates like "tomorrow" or "next Tuesday" to YYYY-MM-DD yourself.

Business hours:
${ctx.hoursText}

Appointment types you can book:
${ctx.typesText}

What you know about ${ctx.orgName} — answer questions ONLY from this:
${ctx.knowledgeText || "(no knowledge base yet — if you don't know, offer a call-back instead of guessing)"}

About the business:
${fillPlaceholders(ctx.extraNotes, ctx) || "(none)"}

How to behave:
- Keep every reply to one or two short sentences, one question at a time. Speak in whichever language the caller uses, and switch if they switch.${ctx.orgNameZh !== ctx.orgName ? ` When you speak Chinese, call the business "${ctx.orgNameZh}".` : ""}
- To book or reschedule: call check_availability first, offer the real open times, confirm the time AND their name, then call book_appointment. Always pass dates as YYYY-MM-DD and times in Western digits (e.g. 11:00 AM).
- Say dates and times in the CALLER'S language. The tools return them in English (e.g. "Monday, June 2 at 11 AM") — translate them when you speak: to a Chinese caller say "6月2号星期一上午11点". Never mix English words into a Chinese sentence.
- Never invent times or facts. If unsure, or they want a person, use create_callback.
- Before you end the call, ask if there's anything else you can help with, and WAIT for their answer. Only end once they confirm they're done — don't hang up the moment you finish a sentence. Then thank them warmly and end the call.`;
}

/** Dynamic variables for an outbound call: the inbound set with the greeting and
 *  system prompt swapped for the outbound versions, plus lead context. */
export function buildOutboundDynamicVariables(
  ctx: ReceptionistContext,
  opts: { leadName: string; purpose: OutboundPurpose; detail?: string }
): Record<string, string> {
  return {
    ...buildReceptionistDynamicVariables(ctx),
    greeting: buildOutboundGreeting(ctx, opts.leadName),
    system_prompt: buildOutboundSystemPrompt(ctx, opts),
    lead_name: opts.leadName || "",
    call_purpose: opts.purpose,
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
- Before you end the call, always ask if there's anything else you can help with, and WAIT for their answer. Only end after they confirm they're all set — never hang up right after answering or while they might still be speaking. Then give a warm goodbye and end the call.`;

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
    // Accept either our canonical params (appointment_type/start) or the ones the
    // Retell function template actually sends (service_type/date/time).
    const type = String(args.appointment_type ?? args.service_type ?? "");
    const start = String(args.start ?? "");
    const dateStr = String(args.date ?? "");
    const timeStr = String(args.time ?? "");
    const callerName = args.caller_name ? String(args.caller_name) : null;
    const clientId = await matchOrCreateClient(ctx.orgId, ctx.fromNumber, callerName);
    const res = await bookAppointment(ctx.orgId, { appointmentTypeName: type, startISO: start, dateStr, timeStr, clientId, callerName });
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
