import OpenAI from "openai";
import { buildEmailSystemInstructions } from "@/lib/agent-ai/promptBuilder";
import { getAgentAiSettings } from "@/lib/agent-ai/settings";
import { resolveLeadOutboundLocale } from "@/lib/locales/resolveLocale";
import { buildEmailUserPrompt, EMAIL_ASSISTANT_SYSTEM_PROMPT } from "./prompts";
import { inferEmailIntentHeuristic } from "./intent";
import { emailNeedsHumanEscalation, isEmailOptOut } from "./safety";
import type { EmailAssistantReply, EmailReplyContext } from "./types";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function emailModel() {
  return (
    process.env.OPENAI_EMAIL_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function buildLeadSummary(ctx: EmailReplyContext) {
  if (!ctx.lead) return "No existing lead record. New email lead.";
  return JSON.stringify({
    leadId: ctx.lead.leadId,
    name: ctx.lead.name,
    email: ctx.lead.email,
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

function buildRecentMessagesText(ctx: EmailReplyContext) {
  if (!ctx.recentMessages.length) return "No prior email messages.";
  return ctx.recentMessages
    .map((m) => `${m.direction.toUpperCase()} | ${m.subject || "(no subject)"}: ${m.body}`)
    .join("\n\n");
}

function fallbackReply(ctx: EmailReplyContext): EmailAssistantReply {
  const intent = inferEmailIntentHeuristic(ctx.subject, ctx.inboundBody);
  const name = ctx.lead?.name?.trim() || "there";
  const subj = ctx.subject.startsWith("Re:") ? ctx.subject : `Re: ${ctx.subject}`;
  let body = `Hi ${name},\n\nThanks for your email. I’d love to help — are you exploring buying, selling, or do you have a specific question I can answer?\n\nBest,\nLeadSmart AI`;
  if (intent === "seller_home_value" || intent === "seller_list_home") {
    body = `Hi ${name},\n\nThanks for reaching out. What’s the property address you’re thinking about? I can help with next steps from there.\n\nBest,\nLeadSmart AI`;
  }
  if (intent === "buyer_listing_inquiry") {
    body = `Hi ${name},\n\nThanks for your interest. Which property or neighborhood are you focused on, and would you like more details or a showing?\n\nBest,\nLeadSmart AI`;
  }
  if (intent === "buyer_financing") {
    body = `Hi ${name},\n\nHappy to help. Are you looking for a lender introduction or a quick affordability overview?\n\nBest,\nLeadSmart AI`;
  }
  return {
    subject: subj,
    replyBody: body,
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
    subject: { type: "string" },
    replyBody: { type: "string" },
    inferredIntent: {
      type: "string",
      enum: [
        "buyer_listing_inquiry",
        "buyer_financing",
        "seller_home_value",
        "seller_list_home",
        "appointment",
        "support",
        "document_request",
        "unknown",
      ],
    },
    extractedData: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
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
        "request_documents",
      ],
    },
    hotLead: { type: "boolean" },
    needsHuman: { type: "boolean" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["subject", "replyBody", "inferredIntent", "nextBestAction", "hotLead", "needsHuman", "tags"],
} as const;

export async function generateEmailAssistantReply(ctx: EmailReplyContext): Promise<EmailAssistantReply> {
  if (isEmailOptOut(ctx.subject, ctx.inboundBody)) {
    return {
      subject: "We’ll stop contacting you",
      replyBody:
        "Understood. We’ll stop future outreach to this email address. If you need help later, you’re always welcome to reach back out.",
      inferredIntent: ctx.inferredIntent,
      nextBestAction: "continue_ai",
      hotLead: false,
      needsHuman: false,
      tags: ["opt_out"],
    };
  }

  if (emailNeedsHumanEscalation(ctx.subject, ctx.inboundBody)) {
    const subj = ctx.subject.startsWith("Re:") ? ctx.subject : `Re: ${ctx.subject}`;
    return {
      subject: subj,
      replyBody:
        "Thank you for your email. I’m flagging this for a team member now so someone can follow up with you directly as soon as possible.",
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
  // Resolve lead's outbound locale; contact-level pref dominates, agent
  // default_language is the fallback. See apps/leadsmartai/lib/locales/resolveLocale.ts.
  const outboundLocale = resolveLeadOutboundLocale({
    leadPreferredLanguage: ctx.lead?.preferredLanguage ?? null,
    agentDefaultOutboundLanguage: agentAi.defaultLanguage,
  });
  const instructions = buildEmailSystemInstructions(
    EMAIL_ASSISTANT_SYSTEM_PROMPT,
    agentAi,
    outboundLocale,
  );

  const prompt = buildEmailUserPrompt({
    leadSummary: buildLeadSummary(ctx),
    recentMessages: buildRecentMessagesText(ctx),
    subject: ctx.subject,
    inboundBody: ctx.inboundBody,
  });

  try {
    const response = await openai.responses.create({
      model: emailModel(),
      instructions,
      input: [{ role: "user", content: prompt }],
      text: {
        format: {
          type: "json_schema",
          name: "email_assistant_reply",
          strict: true,
          schema: replyJsonSchema as unknown as Record<string, unknown>,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) return fallbackReply(ctx);

    const parsed = JSON.parse(outputText) as EmailAssistantReply;
    if (!parsed.inferredIntent) {
      parsed.inferredIntent = inferEmailIntentHeuristic(ctx.subject, ctx.inboundBody);
    }
    if (!Array.isArray(parsed.tags)) parsed.tags = [];
    return parsed;
  } catch {
    return fallbackReply(ctx);
  }
}
