import OpenAI from "openai";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { z } from "zod";
import { DEFAULT_AGENT_AI_SETTINGS } from "@/lib/agent-ai/settings";
import { buildVoiceTranscriptAnalysisInstructions } from "@/lib/agent-ai/promptBuilder";
import type { AgentAiSettings } from "@/lib/agent-ai/types";
import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import { VOICE_TRANSCRIPT_ANALYSIS_SCHEMA } from "./voice-transcript-schema";
import {
  classifyCallIntentFromTranscript,
  detectHotLeadFromCall,
  voiceIntentCategory,
} from "./heuristics";
import { needsHumanFromText } from "./escalation";
import { createCallSummary } from "./summary";
import type { VoiceSessionLanguage } from "./voice-language";
import type { VoiceAnalysisResult, VoiceCallIntent } from "./types";

const LlmOutputSchema = z.object({
  summary: z.string(),
  inferred_intent: z.enum([
    "buyer_listing_inquiry",
    "buyer_financing",
    "seller_home_value",
    "seller_list_home",
    "appointment",
    "support",
    "unknown",
  ]),
  hot_lead: z.boolean(),
  needs_human: z.boolean(),
  reasoning: z.object({
    intent: z.string(),
    hot_lead: z.string(),
    needs_human: z.string(),
  }),
});

const VOICE_INTENT_VALUES: readonly VoiceCallIntent[] = [
  "buyer_listing_inquiry",
  "buyer_financing",
  "seller_home_value",
  "seller_list_home",
  "appointment",
  "support",
  "unknown",
];

function normalizeVoiceIntent(raw: string): VoiceCallIntent {
  const k = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if ((VOICE_INTENT_VALUES as readonly string[]).includes(k)) return k as VoiceCallIntent;
  return "unknown";
}

function heuristicAnalysis(transcript: string): VoiceAnalysisResult {
  const inferredIntent = classifyCallIntentFromTranscript(transcript);
  const needsHuman = needsHumanFromText(transcript);
  const hotLead = detectHotLeadFromCall(transcript, inferredIntent) || needsHuman;
  const summary = createCallSummary({
    transcript,
    inferredIntent,
    hotLead,
    needsHuman,
  });
  const intentRole = voiceIntentCategory(inferredIntent);

  return {
    summary,
    inferredIntent,
    intentRole,
    hotLead,
    needsHuman,
    reasons: {
      intent: "Heuristic keyword / intent rules.",
      hot_lead: hotLead ? "Matched hot-lead heuristics." : undefined,
      needs_human: needsHuman ? "Matched sensitive / escalation heuristics." : undefined,
    },
    source: "heuristic",
  };
}

function parseOutputText(response: OpenAIResponse): string | null {
  const direct = response.output_text?.trim();
  if (direct) return direct;
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    const msg = item as { content?: Array<{ type?: string; text?: string }> };
    for (const part of msg.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text.trim();
      if (typeof (part as { text?: string }).text === "string")
        return (part as { text: string }).text.trim();
    }
  }
  return null;
}

/**
 * OpenAI Responses API JSON analysis with safe fallback to heuristics when key missing or parse fails.
 * @param options.outputLanguage — CRM + summary language after caller preference is resolved.
 * @param options.agentAiSettings — optional per-agent tone (summary phrasing only; classification unchanged).
 */
export async function analyzeVoiceTranscript(
  transcript: string,
  options?: { outputLanguage?: VoiceSessionLanguage; agentAiSettings?: AgentAiSettings }
): Promise<VoiceAnalysisResult> {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return heuristicAnalysis(transcript);
  }

  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) {
    return heuristicAnalysis(transcript);
  }

  try {
    const openai = new OpenAI({ apiKey });
    const style = options?.agentAiSettings ?? DEFAULT_AGENT_AI_SETTINGS;
    const response = await openai.responses.create({
      model,
      instructions: buildVoiceTranscriptAnalysisInstructions(style, options?.outputLanguage),
      input: `Transcript:\n"""${trimmed.slice(0, 8000)}"""`,
      text: {
        format: {
          type: "json_schema",
          name: "voice_call_transcript_analysis",
          strict: true,
          schema: VOICE_TRANSCRIPT_ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      temperature: 0.2,
      max_output_tokens: 700,
      store: false,
    });

    const raw = parseOutputText(response);
    if (!raw) {
      return heuristicAnalysis(transcript);
    }

    const json = JSON.parse(raw) as unknown;
    const parsed = LlmOutputSchema.safeParse(json);
    if (!parsed.success) {
      return heuristicAnalysis(transcript);
    }

    const d = parsed.data;
    const inferredIntent = normalizeVoiceIntent(d.inferred_intent);

    const ruleNeedsHuman = needsHumanFromText(trimmed);
    const ruleHot = detectHotLeadFromCall(trimmed, inferredIntent);

    const needsHuman = Boolean(d.needs_human) || ruleNeedsHuman;
    const hotLead = Boolean(d.hot_lead) || ruleHot || needsHuman;

    return {
      summary: d.summary.trim() || heuristicAnalysis(transcript).summary,
      inferredIntent,
      intentRole: voiceIntentCategory(inferredIntent),
      hotLead,
      needsHuman,
      reasons: {
        intent: d.reasoning.intent,
        hot_lead: d.reasoning.hot_lead,
        needs_human: d.reasoning.needs_human,
      },
      source: "openai",
      model,
    };
  } catch (e) {
    console.error("[voice-transcript-analysis]", e);
    return heuristicAnalysis(transcript);
  }
}
