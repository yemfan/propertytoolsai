import "server-only";

import { sendOutboundEmail } from "@/lib/ai-email/send";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import { getSalesModel, type SalesModelId } from "@/lib/sales-models";

/**
 * Server helpers for the Sales-Model "Launch AI Email" feature.
 *
 * Companion to lib/sales-model-sms.ts. Big differences from SMS:
 *
 *   - No conversation polling. Email isn't real-time the way SMS is;
 *     the modal does a single-shot draft → review → send. The
 *     `message_logs` row goes in via the existing sendOutboundEmail
 *     helper so the rest of the dashboard (lead detail conversation
 *     view, etc.) sees the sent email immediately.
 *
 *   - Drafts are JSON ({subject, body}) — emails carry a separate
 *     subject line. We use OpenAI's response_format: json_object so
 *     parsing is reliable.
 *
 *   - Send goes through `sendOutboundEmail` which already wires:
 *       - Resend (when RESEND_API_KEY is set)
 *       - email_messages logging
 *       - message_logs row (status: "sent" or "queued")
 *       - lead_event log
 *       - contacts.last_contacted_at touch
 */

export type EmailContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  property_address: string | null;
};

// ── Contacts search ──────────────────────────────────────────────

export async function searchContactsForEmail(
  agentId: string,
  q: string,
  limit = 12,
): Promise<EmailContactRow[]> {
  const trimmed = q.trim();
  let query = supabaseAdmin
    .from("contacts")
    .select(
      "id, name, first_name, last_name, email, property_address, last_contacted_at, created_at",
    )
    .eq("agent_id", agentId)
    .order("last_contacted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (trimmed) {
    const safe = trimmed.replace(/[%,]/g, "");
    const pattern = `%${safe}%`;
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[sales-model-email] searchContactsForEmail:", error.message);
    return [];
  }
  type Row = {
    id: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    property_address: string | null;
  };
  return (data as Row[] | null)
    ?.filter((r) => Boolean(r.email && r.email.includes("@")))
    .map((r) => ({
      id: r.id,
      name:
        r.first_name || r.last_name
          ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
          : (r.name ?? null),
      email: r.email,
      property_address: r.property_address,
    })) ?? [];
}

// ── Draft (model-aware) ──────────────────────────────────────────

export async function draftEmailMessage(args: {
  modelId: SalesModelId;
  situation: string;
  contact: EmailContactRow;
}): Promise<
  | { ok: true; subject: string; body: string }
  | { ok: false; code: string; error: string }
> {
  const { modelId, situation, contact } = args;
  const model = getSalesModel(modelId);
  const { apiKey, model: openaiModel } = getOpenAIConfig();

  if (!apiKey) {
    return {
      ok: false,
      code: "ai_unconfigured",
      error: "AI is not configured on this environment.",
    };
  }

  const contactBlock = [
    contact.name ? `Name: ${contact.name}` : "Name: (unknown)",
    contact.email ? `Email: ${contact.email}` : null,
    contact.property_address ? `Property of interest: ${contact.property_address}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are an AI assistant helping a real-estate agent write an email to a contact.

Agent identity (${model.name}):
- ${model.identityTitle.replace(/^You are operating as (a |an )?/, "")}.
- Communication style: ${model.tone}.
- Philosophy: ${model.philosophy}

Email-specific rules:
- Subject line: 4-9 words, punchy, no clickbait, never starts with "Re:" unless replying to an existing thread (this is a fresh outreach).
- Body: 3-6 short paragraphs, plain text only (no markdown). Greet by name if known. Sign off with "Best, " on its own line — agent's name is appended client-side.
- Length: 120-280 words. Conversational, scannable on phone.
- One clear ask. No multiple questions stacked.
- No "[brackets]" placeholders. Do not invent facts. If a fact is needed and the situation didn't supply it, write the sentence around its absence.
- Match the tone EXACTLY. ${model.id === "influencer" ? "Don't go corporate. One emoji is fine, more isn't." : model.id === "closer" ? "Don't get fluffy or apologetic. One CTA, clear ask." : model.id === "advisor" ? "Don't get pushy or salesy. Frame as helpful analysis." : "Default to a clean professional voice the agent can adjust."}

OUTPUT FORMAT — return strict JSON only with exactly two fields:
{
  "subject": "<subject line>",
  "body": "<email body, plain text, paragraph breaks via real \\n\\n>"
}

The "body" field is plain text. Do not include any keys other than subject and body.`;

  const userPrompt = `Situation (what the agent wants this email to accomplish):
${situation || "(no situation provided — write a thoughtful re-engagement email)"}

Contact:
${contactBlock}

Generate the subject + body for this email. Return JSON.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openaiModel,
        temperature: 0.7,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const json = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      const upstreamMsg = json?.error?.message ?? `OpenAI ${res.status}`;
      console.error("[sales-model-email] OpenAI error:", res.status, upstreamMsg);
      return { ok: false, code: "openai_error", error: "AI service error. Try again." };
    }
    const raw = String(json?.choices?.[0]?.message?.content ?? "").trim();
    const parsed = parseEmailJson(raw);
    if (!parsed) {
      return {
        ok: false,
        code: "parse_error",
        error: "Could not parse AI response. Try again.",
      };
    }
    return { ok: true, subject: parsed.subject, body: parsed.body };
  } catch (e) {
    console.error("[sales-model-email] fetch failed:", e);
    return { ok: false, code: "openai_unreachable", error: "Could not reach AI service." };
  }
}

function parseEmailJson(raw: string): { subject: string; body: string } | null {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    const j = JSON.parse(t) as { subject?: unknown; body?: unknown };
    const subject = typeof j.subject === "string" ? j.subject.trim() : "";
    const body = typeof j.body === "string" ? j.body.trim() : "";
    if (!subject || !body) return null;
    return { subject, body };
  } catch {
    return null;
  }
}

// ── Send ─────────────────────────────────────────────────────────

export async function sendEmailForAgent(args: {
  agentId: string;
  contactId: string;
  subject: string;
  body: string;
}): Promise<
  | { ok: true; delivered: boolean; externalMessageId: string | null }
  | { ok: false; code: string; error: string; status?: number }
> {
  const { agentId, contactId, subject, body } = args;

  if (!subject.trim()) {
    return { ok: false, code: "empty_subject", error: "Subject is empty.", status: 400 };
  }
  if (!body.trim()) {
    return { ok: false, code: "empty_body", error: "Email body is empty.", status: 400 };
  }
  if (subject.length > 300) {
    return {
      ok: false,
      code: "subject_too_long",
      error: "Subject is too long (max 300 chars).",
      status: 400,
    };
  }

  // Ownership check + grab email.
  const { data: contactRow } = await supabaseAdmin
    .from("contacts")
    .select("id, email, agent_id")
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
  const email = (contactRow as { email?: string | null }).email;
  if (!email || !email.includes("@")) {
    return {
      ok: false,
      code: "no_email",
      error: "This contact has no email address on file.",
      status: 400,
    };
  }

  try {
    const result = await sendOutboundEmail({
      leadId: contactId,
      to: email,
      subject: subject.trim(),
      body: body.trim(),
      agentId,
      actorType: "agent",
      deliver: true,
    });
    return {
      ok: true,
      delivered: result.delivered,
      externalMessageId: result.externalMessageId,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email send failed";
    console.error("[sales-model-email] sendOutboundEmail threw:", msg);
    if (/RESEND_API_KEY/i.test(msg)) {
      return { ok: false, code: "resend_unconfigured", error: msg, status: 503 };
    }
    return { ok: false, code: "send_error", error: msg, status: 502 };
  }
}
