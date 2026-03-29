import { getOpenAIConfig } from "@/lib/ai/openaiClient";

export type ReplyMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
};

export type GenerateReplyContext = {
  lead: {
    name?: string | null;
    property_address?: string | null;
    search_location?: string | null;
    price_min?: number | null;
    price_max?: number | null;
    intent?: string | null;
    rating?: string | null;
    source?: string | null;
    lead_status?: string | null;
  };
  messages: ReplyMessage[];
  preferences?: Record<string, unknown>;
  /** e.g. "initial outreach" | "1h follow-up" */
  task?: string;
};

function fmtPriceRange(min: number | null | undefined, max: number | null | undefined) {
  if (min == null && max == null) return "not specified";
  if (min != null && max != null) return `$${Math.round(min).toLocaleString()} – $${Math.round(max).toLocaleString()}`;
  if (min != null) return `from $${Math.round(min).toLocaleString()}`;
  return `up to $${Math.round(max as number).toLocaleString()}`;
}

function fallbackReply(ctx: GenerateReplyContext): string {
  const name = ctx.lead.name?.trim() || "there";
  const addr = ctx.lead.property_address?.trim() || ctx.lead.search_location?.trim() || "your area";
  const range = fmtPriceRange(ctx.lead.price_min, ctx.lead.price_max);
  if (ctx.task?.includes("follow")) {
    return `Hi ${name}, just checking in on ${addr}. Still exploring options in the ${range} range? Happy to answer questions — reply anytime. — LeadSmart AI`;
  }
  return `Hi ${name}, thanks for your interest in ${addr}. I can help with next steps and local context (your search around ${range}). What’s the best way to reach you? — LeadSmart AI`;
}

/**
 * AI message generator — uses OpenAI when configured, else deterministic fallback.
 */
export async function generateReply(context: GenerateReplyContext): Promise<string> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) {
    return fallbackReply(context);
  }

  const loc =
    context.lead.property_address?.trim() ||
    context.lead.search_location?.trim() ||
    "Unknown location";
  const range = fmtPriceRange(context.lead.price_min, context.lead.price_max);
  const behavior = [
    context.lead.intent && `Intent signal: ${context.lead.intent}`,
    context.lead.rating && `Rating: ${context.lead.rating}`,
    context.lead.source && `Source: ${context.lead.source}`,
    context.lead.lead_status && `Status: ${context.lead.lead_status}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const transcript = context.messages
    .slice(-12)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const userPrompt = `Task: ${context.task ?? "Write one reply message"}

Lead context:
- Name: ${context.lead.name ?? "unknown"}
- Location: ${loc}
- Price range: ${range}
- Behavior / CRM: ${behavior || "n/a"}

Conversation so far:
${transcript || "(no prior messages)"}

Constraints:
- Single SMS/email friendly message, under 320 characters if possible (max ~500).
- Warm, professional, not spammy.
- Sign off as "— LeadSmart AI" or similar short brand line.
- Ask at most one clear question.
`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant helping real estate agents message leads. Be concise and helpful.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const json = (await res.json()) as any;
    if (!res.ok) {
      console.error("generateReply OpenAI error", res.status, json);
      return fallbackReply(context);
    }
    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    return text || fallbackReply(context);
  } catch (e) {
    console.error("generateReply", e);
    return fallbackReply(context);
  }
}

function parseEmailDraftJson(raw: string): { subject: string; body: string } | null {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    const j = JSON.parse(t) as { subject?: unknown; body?: unknown };
    const subject = String(j.subject ?? "").trim();
    const body = String(j.body ?? "").trim();
    if (!body) return null;
    return { subject: subject || "Following up", body };
  } catch {
    return null;
  }
}

/**
 * Draft an email subject + body for an agent to edit and send (uses OpenAI when configured).
 */
export async function generateEmailReplyDraft(context: GenerateReplyContext): Promise<{
  subject: string;
  body: string;
}> {
  const plainBody = await generateReply({
    ...context,
    task: "Write a professional email reply to the lead (body only, 2–4 short paragraphs).",
  });

  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) {
    const name = context.lead.name?.trim() || "there";
    return {
      subject: `Following up — ${name}`,
      body: plainBody,
    };
  }

  const loc =
    context.lead.property_address?.trim() ||
    context.lead.search_location?.trim() ||
    "Unknown location";
  const range = fmtPriceRange(context.lead.price_min, context.lead.price_max);
  const behavior = [
    context.lead.intent && `Intent: ${context.lead.intent}`,
    context.lead.rating && `Rating: ${context.lead.rating}`,
    context.lead.source && `Source: ${context.lead.source}`,
    context.lead.lead_status && `Status: ${context.lead.lead_status}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const transcript = context.messages
    .slice(-16)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const userPrompt = `You help real estate agents reply by email.

Lead:
- Name: ${context.lead.name ?? "unknown"}
- Location: ${loc}
- Price range: ${range}
- CRM: ${behavior || "n/a"}

Email thread (oldest to newest in transcript):
${transcript || "(no prior messages)"}

Return ONLY valid JSON (no markdown fences) with this shape:
{"subject":"<under 72 characters, professional>","body":"<plain text, 2-4 short paragraphs, warm and helpful>"}

Constraints:
- Subject should be specific (e.g. reference their question or "Next steps for your search") when possible.
- Body: no HTML; sign off with the agent team, not a robot persona.
`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: "You output only compact JSON objects for email drafts. No markdown.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    if (!res.ok) {
      console.error("generateEmailReplyDraft OpenAI error", res.status, json);
      return { subject: `Following up — ${context.lead.name?.trim() || "there"}`, body: plainBody };
    }
    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    const parsed = parseEmailDraftJson(text);
    if (parsed) return parsed;
    return { subject: `Following up — ${context.lead.name?.trim() || "there"}`, body: plainBody };
  } catch (e) {
    console.error("generateEmailReplyDraft", e);
    return { subject: `Following up — ${context.lead.name?.trim() || "there"}`, body: plainBody };
  }
}
