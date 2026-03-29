import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import type { ProgrammaticSeoPayload } from "@/lib/programmaticSeo/types";
import type { OptimizationAction } from "./types";
import { parseOverridePayload } from "./mergePayload";
import { buildOptimizationSystemPrompt, buildOptimizationUserPrompt } from "./prompts";

export type AiOptimizationOutput = {
  title: string;
  meta_description: string;
  payload: ProgrammaticSeoPayload;
  internal_link_suggestions?: string[];
};

function normalizeAiResult(raw: unknown): AiOptimizationOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? "").trim();
  const meta_description = String(o.meta_description ?? "").trim();
  const payload = parseOverridePayload({
    insights: o.insights,
    sections: o.sections,
    faqs: o.faqs,
    source: "ai",
  });
  if (!title || !meta_description || !payload) return null;
  const ils = o.internal_link_suggestions;
  const internal_link_suggestions = Array.isArray(ils)
    ? ils.map((x) => String(x).trim()).filter(Boolean)
    : undefined;
  return { title, meta_description, payload, internal_link_suggestions };
}

export async function runAiOptimization(input: {
  action: OptimizationAction;
  toolName: string;
  toolCategory: string;
  toolTagline: string;
  city: string;
  state: string;
  metrics: { impressions: number; ctr: number; positionAvg: number | null };
  defaultTitle: string;
  defaultDescription: string;
  basePayload: ProgrammaticSeoPayload;
  relatedToolNames: string[];
}): Promise<AiOptimizationOutput | null> {
  if (input.action === "none") return null;

  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) {
    console.warn("[seoOptimization] OPENAI_API_KEY missing");
    return null;
  }

  const place = `${input.city}, ${input.state}`;
  const user = buildOptimizationUserPrompt({
    action: input.action,
    toolName: input.toolName,
    toolCategory: input.toolCategory,
    toolTagline: input.toolTagline,
    city: input.city,
    state: input.state,
    place,
    metrics: input.metrics,
    defaultTitle: input.defaultTitle,
    defaultDescription: input.defaultDescription,
    currentPayload: {
      insights: input.basePayload.insights,
      sections: input.basePayload.sections,
      faqs: input.basePayload.faqs,
    },
    relatedToolNames: input.relatedToolNames,
  });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildOptimizationSystemPrompt() },
          { role: "user", content: user },
        ],
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("seo optimization OpenAI error", res.status, json);
      return null;
    }

    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as unknown;
    return normalizeAiResult(parsed);
  } catch (e) {
    console.warn("runAiOptimization", e);
    return null;
  }
}
