import { generateAIResponse } from "@/lib/ai/aiService";
import { assertAiRateLimit } from "@/lib/ai/rateLimit";
import { resolveUserPlanType } from "@/lib/ai/resolveUserPlan";
import {
  smsFollowUp,
  emailFollowUp,
  sellerReport,
  leadExplanation,
  cmaExplanation,
  notificationText,
  sanitizeForPrompt,
  type LeadPromptInput,
  type PropertyReportInput,
  type CmaPromptInput,
} from "@/lib/ai/prompts";

export type AiPersonalization = {
  city?: string;
  language?: string;
};

async function gateAndGenerate(
  userId: string,
  tool: string,
  prompt: string,
  useCache = true
) {
  const planType = await resolveUserPlanType(userId);
  const gate = await assertAiRateLimit(userId, planType);
  if (!gate.ok) {
    const err = new Error(
      (gate as any).message ?? "AI rate limit exceeded"
    ) as Error & { status?: number; code?: string };
    err.status = 429;
    err.code = "RATE_LIMIT";
    throw err;
  }

  return generateAIResponse({
    prompt,
    userId,
    tool,
    temperature: 0.7,
    useCache,
  });
}

export async function handleAiSms(
  userId: string,
  body: { lead?: LeadPromptInput; personalization?: AiPersonalization }
) {
  const lead = body.lead ?? {};
  const prompt = smsFollowUp(lead, body.personalization);
  return gateAndGenerate(userId, "ai_sms", prompt);
}

export async function handleAiEmail(
  userId: string,
  body: { lead?: LeadPromptInput; personalization?: AiPersonalization }
) {
  const lead = body.lead ?? {};
  const prompt = emailFollowUp(lead, body.personalization);
  return gateAndGenerate(userId, "ai_email", prompt);
}

export async function handleAiReport(
  userId: string,
  body: { property?: PropertyReportInput; personalization?: AiPersonalization }
) {
  const property = body.property ?? {};
  const prompt = sellerReport(property, body.personalization);
  return gateAndGenerate(userId, "ai_report", prompt);
}

export async function handleAiExplainLead(
  userId: string,
  body: { lead?: LeadPromptInput; personalization?: AiPersonalization }
) {
  const lead = body.lead ?? {};
  const prompt = leadExplanation(lead, body.personalization);
  return gateAndGenerate(userId, "ai_explain_lead", prompt);
}

export async function handleAiExplainCma(
  userId: string,
  body: { cma?: CmaPromptInput; personalization?: AiPersonalization }
) {
  const cma = body.cma ?? {};
  const prompt = cmaExplanation(cma, body.personalization);
  return gateAndGenerate(userId, "ai_explain_cma", prompt);
}

export async function handleAiNotification(
  userId: string,
  body: {
    title?: string;
    bodyHint?: string;
    audience?: "agent" | "lead";
    personalization?: AiPersonalization;
  }
) {
  const prompt = notificationText(
    {
      title: sanitizeForPrompt(body.title || "", 120),
      bodyHint: body.bodyHint,
      audience: body.audience,
    },
    body.personalization
  );
  return gateAndGenerate(userId, "ai_notification", prompt);
}

export type ExplainMode = "lead" | "cma" | "notification";

export async function handleAiExplain(
  userId: string,
  body: {
    mode: ExplainMode;
    lead?: LeadPromptInput;
    cma?: CmaPromptInput;
    notification?: { title?: string; bodyHint?: string; audience?: "agent" | "lead" };
    personalization?: AiPersonalization;
  }
) {
  const mode = body.mode;
  if (mode === "lead") return handleAiExplainLead(userId, { lead: body.lead, personalization: body.personalization });
  if (mode === "cma") return handleAiExplainCma(userId, { cma: body.cma, personalization: body.personalization });
  if (mode === "notification") {
    return handleAiNotification(userId, {
      title: body.notification?.title,
      bodyHint: body.notification?.bodyHint,
      audience: body.notification?.audience,
      personalization: body.personalization,
    });
  }
  const err = new Error("Invalid mode. Use lead | cma | notification.") as Error & { status?: number };
  err.status = 400;
  throw err;
}
