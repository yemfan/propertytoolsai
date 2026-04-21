import OpenAI from "openai";
import { buildSmsSystemInstructions } from "@/lib/agent-ai/promptBuilder";
import { getAgentAiSettings } from "@/lib/agent-ai/settings";
import { resolveLeadOutboundLocale } from "@/lib/locales/resolveLocale";
import { buildSmsUserPrompt, SMS_ASSISTANT_SYSTEM_PROMPT } from "./prompts";
import { inferIntentHeuristic } from "./intent";
import { needsHumanEscalation, shouldStopMessaging } from "./safety";
import type { SmsAssistantReply, SmsReplyContext } from "./types";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function smsModel() {
  return (
    process.env.OPENAI_SMS_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function buildLeadSummary(ctx: SmsReplyContext) {
  if (!ctx.lead) return "No existing lead record. New SMS lead.";
  return JSON.stringify({
    leadId: ctx.lead.leadId,
    name: ctx.lead.name,
    phone: ctx.lead.phone,
    status: ctx.lead.status,
    leadScore: ctx.lead.leadScore,
    leadTemperature: ctx.lead.leadTemperature,
    propertyAddress: ctx.lead.propertyAddress,
    city: ctx.lead.city,
    state: ctx.lead.state,
    intent: ctx.lead.intent,
  });
}

function buildRecentMessagesText(ctx: SmsReplyContext) {
  if (!ctx.recentMessages.length) return "No prior SMS messages.";
  return ctx.recentMessages.map((m) => `${m.direction.toUpperCase()}: ${m.body}`).join("\n");
}

function fallbackReply(ctx: SmsReplyContext): SmsAssistantReply {
  const intent = inferIntentHeuristic(ctx.inboundBody);
  const name = ctx.lead?.name?.trim() || "there";
  const addr = ctx.lead?.propertyAddress?.trim();
  let replyText = `Hi ${name} — thanks for texting${addr ? ` about ${addr}` : ""}. What’s the best way to help you today — buying, selling, or a quick question?`;
  if (intent === "seller_home_value" || intent === "seller_list_home") {
    replyText = `Hi ${name} — happy to help. What’s the property address you’re thinking about?`;
  }
  if (intent === "buyer_listing_inquiry") {
    replyText = `Thanks for reaching out. Which listing or area are you interested in, and would you like a tour?`;
  }
  if (intent === "buyer_financing") {
    replyText = `Got it. Are you looking for a lender intro or a quick affordability check?`;
  }
  return {
    replyText,
    inferredIntent: intent,
    nextBestAction: "continue_ai",
    hotLead: false,
    needsHuman: false,
    tags: ["fallback"],
  };
}

const replyJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    replyText: { type: "string" },
    inferredIntent: {
      type: "string",
      enum: [
        "buyer_listing_inquiry",
        "buyer_financing",
        "seller_home_value",
        "seller_list_home",
        "support",
        "appointment",
        "unknown",
      ],
    },
    extractedData: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        propertyAddress: { type: "string" },
        timeline: { type: "string" },
        budget: { type: "number" },
      },
      required: [] as string[],
    },
    nextBestAction: {
      type: "string",
      enum: [
        "continue_ai",
        "notify_agent",
        "schedule_call",
        "send_valuation_link",
        "send_listing_link",
      ],
    },
    hotLead: { type: "boolean" },
    needsHuman: { type: "boolean" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["replyText", "inferredIntent", "nextBestAction", "hotLead", "needsHuman", "tags"],
} as const;

export async function generateSmsAssistantReply(ctx: SmsReplyContext): Promise<SmsAssistantReply> {
  if (shouldStopMessaging(ctx.inboundBody)) {
    return {
      replyText:
        "Understood — we’ll stop messaging this number. If you ever need help again, just text us anytime.",
      inferredIntent: ctx.inferredIntent,
      nextBestAction: "continue_ai",
      hotLead: false,
      needsHuman: false,
      tags: ["opt_out"],
    };
  }

  if (needsHumanEscalation(ctx.inboundBody)) {
    return {
      replyText:
        "Thanks for reaching out. I’m flagging this for a team member now so someone can follow up directly as soon as possible.",
      inferredIntent: ctx.inferredIntent,
      nextBestAction: "notify_agent",
      hotLead: true,
      needsHuman: true,
      tags: ["human_escalation"],
    };
  }

  const openai = getOpenAI();
  if (!openai) {
    return fallbackReply(ctx);
  }

  const agentAi = await getAgentAiSettings(ctx.lead?.assignedAgentId ?? undefined);
  // Resolve the lead's outbound locale through the registry-backed resolver.
  // Contact-level preference dominates; agent's existing default_language
  // (from agent_ai_settings, surfaced as agentAi.defaultLanguage with
  // values 'en' | 'zh' | 'auto') is the fallback. 'auto' and unknown
  // values coerce back to 'en' inside the resolver.
  const outboundLocale = resolveLeadOutboundLocale({
    leadPreferredLanguage: ctx.lead?.preferredLanguage ?? null,
    agentDefaultOutboundLanguage: agentAi.defaultLanguage,
  });
  const instructions = buildSmsSystemInstructions(
    SMS_ASSISTANT_SYSTEM_PROMPT,
    agentAi,
    outboundLocale,
  );

  const prompt = buildSmsUserPrompt({
    inboundBody: ctx.inboundBody,
    leadSummary: buildLeadSummary(ctx),
    recentMessages: buildRecentMessagesText(ctx),
  });

  try {
    const response = await openai.responses.create({
      model: smsModel(),
      instructions,
      input: [{ role: "user", content: prompt }],
      text: {
        format: {
          type: "json_schema",
          name: "sms_assistant_reply",
          strict: true,
          schema: replyJsonSchema as unknown as Record<string, unknown>,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      return fallbackReply(ctx);
    }

    const parsed = JSON.parse(outputText) as SmsAssistantReply;
    if (!parsed.inferredIntent) {
      parsed.inferredIntent = inferIntentHeuristic(ctx.inboundBody);
    }
    if (!Array.isArray(parsed.tags)) {
      parsed.tags = [];
    }
    return parsed;
  } catch {
    return fallbackReply(ctx);
  }
}
