import "server-only";

import { sendSMS } from "@/lib/twilioSms";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import { getSelectedSalesModelServer } from "@/lib/sales-model-server";
import { getSalesModel, DEFAULT_SALES_MODEL } from "@/lib/sales-models";

/**
 * Missed-call text-back service.
 *
 * Three responsibilities:
 *
 *   1. Read/write `missed_call_settings` for an agent (used by the
 *      settings page + the voice webhook).
 *
 *   2. Build the `<Dial>` TwiML the inbound voice webhook returns
 *      when the agent has missed-call enabled. The TwiML's `action`
 *      URL fires after the call leg ends, with `DialCallStatus`
 *      indicating whether the agent picked up.
 *
 *   3. Handle the dial-result callback: on no-answer / busy / failed,
 *      send the auto-text-back SMS to the original caller, optionally
 *      AI-personalized when the caller is a known contact, and log
 *      the row in `call_logs` with status='missed'.
 *
 * The settings table is the single source of truth — we never bake
 * defaults into the webhook handler beyond the upsert seed in
 * `getOrInitSettings`.
 */

export type MissedCallSettings = {
  agent_id: string;
  enabled: boolean;
  ring_timeout_seconds: number;
  message_template: string;
  use_ai_personalization: boolean;
  created_at: string;
  updated_at: string;
};

const DEFAULT_TEMPLATE =
  "Hey {{caller_name}} — {{agent_first_name}} here. Sorry I missed your call. What's the best way I can help? Happy to text or set up a quick call back.";

const DEFAULT_RING_TIMEOUT_SECONDS = 20;

// ── Settings ──────────────────────────────────────────────────────

/**
 * Read settings, creating a default disabled row on first read so
 * downstream code can always assume the row exists. Returns the
 * default shape on DB error rather than throwing — the voice
 * webhook should never crash on a settings lookup.
 */
export async function getOrInitSettings(
  agentId: string,
): Promise<MissedCallSettings> {
  const { data, error } = await supabaseAdmin
    .from("missed_call_settings")
    .select(
      "agent_id, enabled, ring_timeout_seconds, message_template, use_ai_personalization, created_at, updated_at",
    )
    .eq("agent_id", agentId)
    .maybeSingle();

  if (!error && data) return data as MissedCallSettings;

  // Seed a default row. Disabled by default — agents have to opt
  // in from settings, since the feature redirects calls.
  const seed: MissedCallSettings = {
    agent_id: agentId,
    enabled: false,
    ring_timeout_seconds: DEFAULT_RING_TIMEOUT_SECONDS,
    message_template: DEFAULT_TEMPLATE,
    use_ai_personalization: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await supabaseAdmin
    .from("missed_call_settings")
    .upsert(seed, { onConflict: "agent_id" });

  return seed;
}

export async function updateSettings(
  agentId: string,
  patch: Partial<{
    enabled: boolean;
    ring_timeout_seconds: number;
    message_template: string;
    use_ai_personalization: boolean;
  }>,
): Promise<{ ok: true; settings: MissedCallSettings } | { ok: false; error: string }> {
  // Validate ring timeout if provided.
  if (
    patch.ring_timeout_seconds !== undefined &&
    (patch.ring_timeout_seconds < 5 || patch.ring_timeout_seconds > 60)
  ) {
    return {
      ok: false,
      error: "ring_timeout_seconds must be between 5 and 60.",
    };
  }
  if (
    patch.message_template !== undefined &&
    !patch.message_template.trim()
  ) {
    return { ok: false, error: "message_template cannot be empty." };
  }
  if (
    patch.message_template !== undefined &&
    patch.message_template.length > 1500
  ) {
    return {
      ok: false,
      error: "message_template is too long (max 1500 chars).",
    };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("missed_call_settings")
    .upsert(
      {
        agent_id: agentId,
        ...patch,
        updated_at: nowIso,
      },
      { onConflict: "agent_id" },
    )
    .select(
      "agent_id, enabled, ring_timeout_seconds, message_template, use_ai_personalization, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("[missed-call] updateSettings:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, settings: data as MissedCallSettings };
}

// ── Phone normalization ──────────────────────────────────────────

/**
 * Convert raw input to E.164 (`+1XXXXXXXXXX`) for Twilio API calls.
 * Returns null when the input doesn't look like a US 10-digit number.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Convert any phone format to `(xxx) xxx-xxxx` for contact-table lookups. */
export function toUsDisplayPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return null;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// ── Contact lookup by phone ──────────────────────────────────────

/**
 * Resolves a contact for `agentId` by an inbound caller's phone.
 * Tries `phone_number` first (canonical CRM format), then `phone`
 * (legacy column), then digits-only ilike. Returns null when none
 * of the lookups land — which means the caller is "unknown" and the
 * text-back falls back to a generic salutation.
 */
export async function findContactByPhone(
  agentId: string,
  phoneRaw: string,
): Promise<{
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  property_address: string | null;
} | null> {
  const usPhone = toUsDisplayPhone(phoneRaw);
  const digits = phoneRaw.replace(/\D/g, "").slice(-10);

  type Row = {
    id: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    phone_number: string | null;
    email: string | null;
    property_address: string | null;
  };

  const cols =
    "id, name, first_name, last_name, phone, phone_number, email, property_address";

  if (usPhone) {
    const byNumber = await supabaseAdmin
      .from("contacts")
      .select(cols)
      .eq("agent_id", agentId)
      .eq("phone_number", usPhone)
      .maybeSingle();
    if (byNumber.data) return shape(byNumber.data as Row);

    const byPhone = await supabaseAdmin
      .from("contacts")
      .select(cols)
      .eq("agent_id", agentId)
      .eq("phone", usPhone)
      .maybeSingle();
    if (byPhone.data) return shape(byPhone.data as Row);
  }

  if (digits.length === 10) {
    const byDigits = await supabaseAdmin
      .from("contacts")
      .select(cols)
      .eq("agent_id", agentId)
      .ilike("phone", `%${digits}%`)
      .limit(1);
    const first = (byDigits.data as Row[] | null)?.[0];
    if (first) return shape(first);
  }

  return null;

  function shape(r: Row) {
    return {
      id: r.id,
      name:
        r.first_name || r.last_name
          ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
          : (r.name ?? null),
      phone: r.phone_number ?? r.phone ?? null,
      email: r.email,
      property_address: r.property_address,
    };
  }
}

// ── Agent lookup ─────────────────────────────────────────────────

export async function getAgentForwardingInfo(agentId: string): Promise<{
  forwarding_phone: string | null;
  full_name: string | null;
  user_id: string | null;
} | null> {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("forwarding_phone, full_name, auth_user_id")
    .eq("id", agentId)
    .maybeSingle();
  if (!data) return null;
  return {
    forwarding_phone: (data as { forwarding_phone?: string | null }).forwarding_phone ?? null,
    full_name: (data as { full_name?: string | null }).full_name ?? null,
    user_id: (data as { auth_user_id?: string | null }).auth_user_id ?? null,
  };
}

// ── Template substitution ────────────────────────────────────────

export function renderTemplate(
  template: string,
  vars: { caller_name: string; agent_first_name: string; agent_brand: string | null },
): string {
  return template
    .replace(/\{\{\s*caller_name\s*\}\}/gi, vars.caller_name)
    .replace(/\{\{\s*agent_first_name\s*\}\}/gi, vars.agent_first_name)
    .replace(/\{\{\s*agent_brand\s*\}\}/gi, vars.agent_brand ?? vars.agent_first_name)
    .trim();
}

function firstNameOf(fullName: string | null): string {
  if (!fullName) return "your agent";
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || "your agent";
}

// ── AI personalization ───────────────────────────────────────────

/**
 * When AI personalization is on AND the caller is a known contact,
 * draft a tailored text-back via OpenAI in the agent's selected
 * sales-model tone. Returns null on any error so the caller falls
 * back to the template.
 */
async function aiDraftTextBack(args: {
  agentUserId: string;
  agentFirstName: string;
  contactName: string;
  contactContext: string;
}): Promise<string | null> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return null;

  const modelId = (await getSelectedSalesModelServer(args.agentUserId)) ?? DEFAULT_SALES_MODEL;
  const sm = getSalesModel(modelId);

  const systemPrompt = `You are an AI assistant helping a real-estate agent send an automatic SMS to a contact who just called and was missed.

Agent identity (${sm.name}):
- ${sm.identityTitle.replace(/^You are operating as (a |an )?/, "")}.
- Communication style: ${sm.tone}.

Rules:
- Plain text only. Max 280 characters. No emojis unless the tone explicitly calls for them${sm.id === "influencer" ? " (one is fine)" : " (avoid)"}.
- Acknowledge that the agent missed the call. Don't over-apologize.
- Address the contact by first name when supplied.
- End with one specific question or low-friction next step.
- Sign off as "— ${args.agentFirstName}" only if natural; not required.
- Do not invent facts. Use only what's in the contact context.

OUTPUT: only the SMS body. No preamble.`;

  const userPrompt = `Contact: ${args.contactName}
Context (only what we know):
${args.contactContext || "(no additional context)"}

The contact just called and the agent didn't pick up. Write the auto-SMS reply in the agent's tone.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    if (!res.ok) return null;
    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    return text || null;
  } catch (e) {
    console.error("[missed-call] aiDraftTextBack failed:", e);
    return null;
  }
}

// ── Main entry: handle a dial-result no-answer ───────────────────

/**
 * Called from /api/twilio/voice/dial-result when the agent's leg
 * ended without picking up. Sends the auto-SMS to the original
 * caller (the inbound `From` number) and writes a `call_logs` row
 * tagged status='missed' with the linked SMS message_log id.
 */
export async function handleMissedCall(args: {
  agentId: string;
  callerPhone: string;
  twilioCallSid: string;
}): Promise<{ smsSent: boolean; logId: string | null; error?: string }> {
  const settings = await getOrInitSettings(args.agentId);
  if (!settings.enabled) {
    // Still log the missed call so the activity feed shows it.
    await logMissedCall(args, null);
    return { smsSent: false, logId: null };
  }

  const callerE164 = toE164(args.callerPhone);
  if (!callerE164) {
    await logMissedCall(args, null);
    return {
      smsSent: false,
      logId: null,
      error: "Caller phone is not a valid US number.",
    };
  }

  const agent = await getAgentForwardingInfo(args.agentId);
  const agentFirstName = firstNameOf(agent?.full_name ?? null);

  // Resolve contact (if any) for personalization + the contact_id
  // back-link on the call_logs + message_logs rows.
  const contact = await findContactByPhone(args.agentId, args.callerPhone);
  const callerName = contact?.name?.trim()
    ? contact.name.trim().split(/\s+/)[0]
    : "there";

  // Build the message body.
  let body: string | null = null;
  if (settings.use_ai_personalization && contact && agent?.user_id) {
    const ctxLines = [
      contact.phone ? `Phone: ${contact.phone}` : null,
      contact.email ? `Email: ${contact.email}` : null,
      contact.property_address
        ? `Property of interest: ${contact.property_address}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    body = await aiDraftTextBack({
      agentUserId: agent.user_id,
      agentFirstName,
      contactName: contact.name ?? callerName,
      contactContext: ctxLines,
    });
  }
  if (!body) {
    body = renderTemplate(settings.message_template, {
      caller_name: callerName,
      agent_first_name: agentFirstName,
      agent_brand: null,
    });
  }

  // Send via existing Twilio SMS helper. sendSMS writes a
  // message_logs row keyed by contact_id when we pass it; we do
  // when the caller is recognized.
  let textbackMessageLogId: string | null = null;
  let smsSent = false;
  try {
    const sendRes = await sendSMS(callerE164, body, contact?.id);
    textbackMessageLogId = sendRes.messageLogId;
    smsSent = true;
  } catch (e) {
    console.error("[missed-call] sendSMS failed:", e);
  }

  const logId = await logMissedCall(args, {
    contactId: contact?.id ?? null,
    textbackMessageLogId,
    smsSent,
  });

  return { smsSent, logId };
}

async function logMissedCall(
  args: { agentId: string; callerPhone: string; twilioCallSid: string },
  meta:
    | {
        contactId: string | null;
        textbackMessageLogId: string | null;
        smsSent: boolean;
      }
    | null,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("call_logs")
    .insert({
      agent_id: args.agentId,
      contact_id: meta?.contactId ?? null,
      twilio_call_sid: args.twilioCallSid,
      direction: "inbound",
      status: "missed",
      from_phone: args.callerPhone,
      textback_message_log_id: meta?.textbackMessageLogId ?? null,
      notes: meta?.smsSent
        ? "Auto text-back sent."
        : meta === null
          ? "Missed; text-back disabled in settings."
          : "Missed; text-back send failed.",
    })
    .select("id")
    .single();
  if (error) {
    console.error("[missed-call] logMissedCall insert failed:", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

// ── Activity log read ────────────────────────────────────────────

export type CallLogEntry = {
  id: string;
  contact_id: string | null;
  contact_name: string | null;
  direction: "inbound" | "outbound";
  status: string;
  from_phone: string | null;
  to_phone: string | null;
  duration_seconds: number | null;
  textback_sent: boolean;
  notes: string | null;
  created_at: string;
};

export async function listRecentCalls(
  agentId: string,
  limit = 50,
): Promise<CallLogEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("call_logs")
    .select(
      "id, contact_id, direction, status, from_phone, to_phone, duration_seconds, textback_message_log_id, notes, created_at",
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[missed-call] listRecentCalls:", error.message);
    return [];
  }

  type Row = {
    id: string;
    contact_id: string | null;
    direction: "inbound" | "outbound";
    status: string;
    from_phone: string | null;
    to_phone: string | null;
    duration_seconds: number | null;
    textback_message_log_id: string | null;
    notes: string | null;
    created_at: string;
  };

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  // Resolve contact names in one batch query.
  const contactIds = Array.from(
    new Set(rows.map((r) => r.contact_id).filter(Boolean) as string[]),
  );
  const nameByContactId = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("id, name, first_name, last_name")
      .in("id", contactIds);
    type C = { id: string; name: string | null; first_name: string | null; last_name: string | null };
    for (const c of (contacts ?? []) as C[]) {
      const fullName =
        c.first_name || c.last_name
          ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
          : (c.name ?? "");
      if (fullName) nameByContactId.set(c.id, fullName);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    contact_id: r.contact_id,
    contact_name: r.contact_id ? (nameByContactId.get(r.contact_id) ?? null) : null,
    direction: r.direction,
    status: r.status,
    from_phone: r.from_phone,
    to_phone: r.to_phone,
    duration_seconds: r.duration_seconds,
    textback_sent: r.textback_message_log_id != null,
    notes: r.notes,
    created_at: r.created_at,
  }));
}
