import type { AIReplyResponse, LeadReplyContext, ReplyGoal, ReplyTone, SuggestedReply } from "./types";
import {
  buildFallbackSuggestions,
  buildReplySystemPrompt,
  buildReplyUserPrompt,
} from "./prompts";

const TONES: ReplyTone[] = ["professional", "friendly", "urgent", "consultative"];
const GOALS: ReplyGoal[] = [
  "answer_question",
  "book_tour",
  "move_to_call",
  "collect_financing_info",
  "send_similar_homes",
  "general_followup",
];

function extractResponsesApiText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (typeof o.output_text === "string" && o.output_text.trim()) {
    return o.output_text.trim();
  }
  const out = o.output;
  if (!Array.isArray(out)) return null;
  const parts: string[] = [];
  for (const block of out) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const content = b.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (!c || typeof c !== "object") continue;
      const item = c as Record<string, unknown>;
      if (typeof item.text === "string") parts.push(item.text);
    }
  }
  const joined = parts.join("").trim();
  return joined || null;
}

function normalizeSuggestion(raw: unknown): SuggestedReply | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.body !== "string" || !r.body.trim()) return null;
  if (typeof r.label !== "string" || !r.label.trim()) return null;
  const tone = r.tone;
  const goal = r.goal;
  if (typeof tone !== "string" || !TONES.includes(tone as ReplyTone)) return null;
  if (typeof goal !== "string" || !GOALS.includes(goal as ReplyGoal)) return null;
  const subject =
    r.subject === null || r.subject === undefined
      ? null
      : typeof r.subject === "string"
        ? r.subject
        : null;
  return {
    label: r.label.trim(),
    tone: tone as ReplyTone,
    goal: goal as ReplyGoal,
    subject,
    body: r.body.trim(),
  };
}

function normalizeAiReply(parsed: unknown): AIReplyResponse | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.reasoningSummary !== "string") return null;
  if (!Array.isArray(p.suggestions)) return null;
  const suggestions = p.suggestions
    .map(normalizeSuggestion)
    .filter((s): s is SuggestedReply => s !== null)
    .slice(0, 3);
  if (!suggestions.length) return null;
  return {
    reasoningSummary: p.reasoningSummary.trim(),
    suggestions,
  };
}

async function tryOpenAI(context: LeadReplyContext): Promise<AIReplyResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REPLY_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: buildReplySystemPrompt() }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: buildReplyUserPrompt(context) }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "agent_reply_suggestions",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reasoningSummary: { type: "string" },
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string" },
                      tone: {
                        type: "string",
                        enum: ["professional", "friendly", "urgent", "consultative"],
                      },
                      goal: {
                        type: "string",
                        enum: [
                          "answer_question",
                          "book_tour",
                          "move_to_call",
                          "collect_financing_info",
                          "send_similar_homes",
                          "general_followup",
                        ],
                      },
                      subject: { type: ["string", "null"] },
                      body: { type: "string" },
                    },
                    required: ["label", "tone", "goal", "subject", "body"],
                  },
                },
              },
              required: ["reasoningSummary", "suggestions"],
            },
          },
        },
      }),
    });

    if (!response.ok) return null;
    const json: unknown = await response.json();
    const text = extractResponsesApiText(json);
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    return normalizeAiReply(parsed);
  } catch {
    return null;
  }
}

export async function generateAgentReplySuggestions(
  context: LeadReplyContext
): Promise<AIReplyResponse> {
  const llmResult = await tryOpenAI(context);
  if (llmResult) return llmResult;
  return buildFallbackSuggestions(context);
}
