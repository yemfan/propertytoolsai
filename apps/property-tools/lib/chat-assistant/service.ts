import type { ChatAssistantContext, ChatAssistantResponse, DraftReply, NextBestAction } from "./types";
import { buildChatAssistantSystemPrompt, buildChatAssistantUserPrompt } from "./prompts";

const SENTIMENTS: Array<ChatAssistantResponse["sentiment"]> = ["hot", "warm", "cold"];
const ACTION_TYPES: NextBestAction["actionType"][] = [
  "send_reply",
  "book_call",
  "schedule_tour",
  "send_similar_homes",
  "request_financing_info",
  "send_cma",
  "follow_up_later",
];
const PRIORITIES: NextBestAction["priority"][] = ["high", "medium", "low"];

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

function normalizeDraft(raw: unknown): DraftReply | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.body !== "string" || !r.body.trim()) return null;
  if (typeof r.label !== "string" || !r.label.trim()) return null;
  const subject =
    r.subject === null || r.subject === undefined
      ? null
      : typeof r.subject === "string"
        ? r.subject
        : null;
  return { label: r.label.trim(), subject, body: r.body.trim() };
}

function normalizeAction(raw: unknown): NextBestAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.label !== "string" || !r.label.trim()) return null;
  if (typeof r.reason !== "string" || !r.reason.trim()) return null;
  const at = r.actionType;
  const pr = r.priority;
  if (typeof at !== "string" || !ACTION_TYPES.includes(at as NextBestAction["actionType"])) return null;
  if (typeof pr !== "string" || !PRIORITIES.includes(pr as NextBestAction["priority"])) return null;
  return {
    label: r.label.trim(),
    reason: r.reason.trim(),
    actionType: at as NextBestAction["actionType"],
    priority: pr as NextBestAction["priority"],
  };
}

function normalizeChatAssistantResponse(parsed: unknown): ChatAssistantResponse | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.summary !== "string" || !p.summary.trim()) return null;
  const sent = p.sentiment;
  if (typeof sent !== "string" || !SENTIMENTS.includes(sent as ChatAssistantResponse["sentiment"])) {
    return null;
  }
  if (!Array.isArray(p.nextBestActions) || !Array.isArray(p.suggestedReplies)) return null;
  const nextBestActions = p.nextBestActions
    .map(normalizeAction)
    .filter((a): a is NextBestAction => a !== null)
    .slice(0, 4);
  const suggestedReplies = p.suggestedReplies
    .map(normalizeDraft)
    .filter((d): d is DraftReply => d !== null)
    .slice(0, 3);
  if (!nextBestActions.length || !suggestedReplies.length) return null;
  return {
    summary: p.summary.trim(),
    sentiment: sent as ChatAssistantResponse["sentiment"],
    nextBestActions,
    suggestedReplies,
  };
}

async function tryOpenAI(context: ChatAssistantContext): Promise<ChatAssistantResponse | null> {
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
        model: process.env.OPENAI_CHAT_ASSISTANT_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: buildChatAssistantSystemPrompt() }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: buildChatAssistantUserPrompt(context) }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "chat_assistant_response",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                sentiment: { type: "string", enum: ["hot", "warm", "cold"] },
                nextBestActions: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string" },
                      reason: { type: "string" },
                      actionType: {
                        type: "string",
                        enum: [
                          "send_reply",
                          "book_call",
                          "schedule_tour",
                          "send_similar_homes",
                          "request_financing_info",
                          "send_cma",
                          "follow_up_later",
                        ],
                      },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["label", "reason", "actionType", "priority"],
                  },
                },
                suggestedReplies: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string" },
                      subject: { type: ["string", "null"] },
                      body: { type: "string" },
                    },
                    required: ["label", "subject", "body"],
                  },
                },
              },
              required: ["summary", "sentiment", "nextBestActions", "suggestedReplies"],
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
    return normalizeChatAssistantResponse(parsed);
  } catch {
    return null;
  }
}

export function fallbackResponse(context: ChatAssistantContext): ChatAssistantResponse {
  const listingLead = context.leadSource === "listing_inquiry";
  const affordabilityLead = context.leadSource === "affordability_report";
  const smartMatchLead = context.leadSource === "smart_property_match";
  const sellerLead = context.leadSource === "home_value_estimate";

  if (listingLead) {
    return {
      summary: `This lead is focused on a specific listing${context.listingAddress ? ` (${context.listingAddress})` : ""} and should be moved toward a conversation or showing quickly.`,
      sentiment: "hot",
      nextBestActions: [
        {
          label: "Reply immediately",
          reason: "Fast response matters most for listing inquiries.",
          actionType: "send_reply",
          priority: "high",
        },
        {
          label: "Offer a showing",
          reason: "The strongest next step is to convert interest into a tour.",
          actionType: "schedule_tour",
          priority: "high",
        },
        {
          label: "Offer similar homes",
          reason: "This keeps the lead engaged even if the original home is not ideal.",
          actionType: "send_similar_homes",
          priority: "medium",
        },
      ],
      suggestedReplies: [
        {
          label: "Confirm interest",
          subject: context.listingAddress ? `Re: ${context.listingAddress}` : null,
          body: `Hi ${context.leadName || "there"}, thanks for your interest${context.listingAddress ? ` in ${context.listingAddress}` : ""}. I'd be happy to help with details or set up a showing. What time works best for you?`,
        },
        {
          label: "Offer similar homes",
          subject: null,
          body: `Hi ${context.leadName || "there"}, if you'd like, I can also send you a few similar homes in the same area and price range so you can compare options more easily.`,
        },
      ],
    };
  }

  if (affordabilityLead) {
    return {
      summary: `This buyer lead should be moved toward financing clarity and a targeted home search based on budget.`,
      sentiment: "warm",
      nextBestActions: [
        {
          label: "Clarify financing status",
          reason: "Budget-based leads convert better once pre-approval status is known.",
          actionType: "request_financing_info",
          priority: "high",
        },
        {
          label: "Offer budget-matched homes",
          reason: "Showing inventory in budget turns interest into search behavior.",
          actionType: "send_similar_homes",
          priority: "high",
        },
      ],
      suggestedReplies: [
        {
          label: "Affordability next step",
          subject: "Your affordability results",
          body: `Hi ${context.leadName || "there"}, thanks for reviewing your affordability results. The next best step is to confirm your financing and narrow down homes that fit your real budget. I can help with both if you'd like.`,
        },
      ],
    };
  }

  if (smartMatchLead) {
    return {
      summary: `This lead already engaged with personalized matching, which is a strong sign of buyer intent. Move them toward curated options and direct conversation.`,
      sentiment: "warm",
      nextBestActions: [
        {
          label: "Send best-fit homes",
          reason: "The lead already responded to AI matching, so more tailored homes are the best next step.",
          actionType: "send_similar_homes",
          priority: "high",
        },
        {
          label: "Offer a quick call",
          reason: "A short consultation can sharpen preferences and improve conversion.",
          actionType: "book_call",
          priority: "medium",
        },
      ],
      suggestedReplies: [
        {
          label: "Continue Smart Match",
          subject: null,
          body: `Hi ${context.leadName || "there"}, I saw the homes you matched with and can help narrow things down even further. If you'd like, I can send you a tighter list based on your budget and priorities.`,
        },
      ],
    };
  }

  if (sellerLead) {
    return {
      summary: `This seller lead should be moved toward a CMA or consultation about timing and pricing strategy.`,
      sentiment: "warm",
      nextBestActions: [
        {
          label: "Offer a CMA",
          reason: "Seller leads convert better when you move from estimate to real pricing strategy.",
          actionType: "send_cma",
          priority: "high",
        },
      ],
      suggestedReplies: [
        {
          label: "Move to CMA",
          subject: "Next step on your home value",
          body: `Hi ${context.leadName || "there"}, thanks for checking your home value. If you'd like, I can help you go one step further and review how your home compares with recent nearby sales and what that could mean in today's market.`,
        },
      ],
    };
  }

  return {
    summary: "This lead needs a prompt human response and a clear next step.",
    sentiment: "warm",
    nextBestActions: [
      {
        label: "Reply now",
        reason: "A live response is the most important next action.",
        actionType: "send_reply",
        priority: "high",
      },
    ],
    suggestedReplies: [
      {
        label: "General response",
        subject: null,
        body: `Hi ${context.leadName || "there"}, thanks for reaching out. I'd be happy to help with next steps and answer any questions you have.`,
      },
    ],
  };
}

export async function generateChatAssistantResponse(
  context: ChatAssistantContext
): Promise<ChatAssistantResponse> {
  const llm = await tryOpenAI(context);
  if (llm) return llm;
  return fallbackResponse(context);
}
