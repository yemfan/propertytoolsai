import OpenAI from "openai";
import { buildReengagementUserPrompt } from "./prompts";
import type { ReengagementChannel, ReengagementLead } from "./types";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function reengagementModel() {
  return (
    process.env.OPENAI_REENGAGEMENT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function fallbackBody(lead: ReengagementLead, stepType: string) {
  const n = lead.name?.split(/\s+/)[0] || "there";
  if (stepType === "last_attempt") {
    return `Hi ${n} — last quick check from me on the home search. If timing changed, no worries. Want me to close the loop?`;
  }
  if (stepType === "nudge") {
    return `Hi ${n}, following up from earlier. Still exploring ${lead.city ? `in ${lead.city}` : "options"}? Happy to help whenever you're ready.`;
  }
  return `Hi ${n}! It's been a bit — thought I'd check in. Still looking for the right place${lead.city ? ` around ${lead.city}` : ""}? Here if you need anything.`;
}

export async function generateReengagementMessage(params: {
  lead: ReengagementLead;
  channel: ReengagementChannel;
  stepType: string;
  templateHint: string | null;
  useAi: boolean;
}): Promise<{ body: string; subject: string | null }> {
  const { lead, channel, stepType, templateHint, useAi } = params;

  if (!useAi) {
    return {
      body: fallbackBody(lead, stepType),
      subject: channel === "email" ? "Quick check-in" : null,
    };
  }

  const openai = getOpenAI();
  if (!openai) {
    return {
      body: fallbackBody(lead, stepType),
      subject: channel === "email" ? "Quick check-in" : null,
    };
  }

  const userPrompt = buildReengagementUserPrompt({ lead, channel, stepType, templateHint });
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      body: { type: "string" },
      subject: { type: ["string", "null"] },
    },
    required: ["body", "subject"],
  } as const;

  try {
    const response = await openai.responses.create({
      model: reengagementModel(),
      instructions:
        "You write JSON-only outputs for a real estate CRM re-engagement tool. Obey length and tone rules.",
      input: [{ role: "user", content: userPrompt }],
      text: {
        format: {
          type: "json_schema",
          name: "reengagement_message",
          strict: true,
          schema: schema as unknown as Record<string, unknown>,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) throw new Error("empty output");
    const parsed = JSON.parse(outputText) as { body: string; subject: string | null };
    let body = (parsed.body || "").trim();
    if (channel === "sms" && body.length > 320) body = body.slice(0, 317) + "...";
    return {
      body: body || fallbackBody(lead, stepType),
      subject: channel === "email" ? (parsed.subject || "Quick check-in") : null,
    };
  } catch {
    return {
      body: fallbackBody(lead, stepType),
      subject: channel === "email" ? "Quick check-in" : null,
    };
  }
}
