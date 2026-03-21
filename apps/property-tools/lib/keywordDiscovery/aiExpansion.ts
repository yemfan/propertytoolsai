import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import { classifyIntentHeuristic, parseIntent } from "./intent";
import { normalizeKeywordForDedupe } from "./normalize";
import type { ExpandedKeywordRow } from "./types";

type AiEnvelope = { variations: { phrase: string; intent: string; cluster_hint?: string | null }[] };

function normalizeAiRows(raw: unknown): ExpandedKeywordRow[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = Array.isArray(o.variations) ? o.variations : Array.isArray(raw) ? (raw as unknown[]) : [];
  const out: ExpandedKeywordRow[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const phrase = String(rec.phrase ?? "").trim();
    if (!phrase) continue;
    let intent = parseIntent(rec.intent) ?? classifyIntentHeuristic(phrase);
    const cluster_hint = rec.cluster_hint != null ? String(rec.cluster_hint).trim() : null;
    out.push({ phrase, intent: intent as ExpandedKeywordRow["intent"], cluster_hint: cluster_hint || null });
  }
  return out;
}

/**
 * Ask the model for `minCount+` distinct search-query style phrases per seed.
 */
export async function expandSeedKeywordsWithAi(
  seed: string,
  minCount: number
): Promise<ExpandedKeywordRow[]> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return [];

  const prompt = `You are an SEO keyword researcher for US real estate (buyers, investors, agents).

Seed phrase: "${seed}"

Generate at least ${minCount} DISTINCT search-query variations (include head terms, long-tail, questions, local modifiers without requiring a city name in every phrase). Mix:
- calculator / tool-style queries where relevant
- educational "what/how/why" queries
- comparison queries (vs, best, compare)

Return JSON only with this shape:
{ "variations": [ { "phrase": string, "intent": "tool" | "informational" | "comparison", "cluster_hint": string | null } ] }

Rules:
- "intent": classify each phrase: tool (calculator/estimate/tool intent), informational (learn/guide), comparison (vs/compare/best).
- "cluster_hint": optional short slug if it maps to a topic like: first-time-home-buyer-guide, mortgage-rates-explained, rental-property-investing, cap-rate-explained, refinance-guide — or null.
- No duplicates. Phrases <= 120 chars. English only.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output only valid JSON. No markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("keyword discovery OpenAI error", res.status, json);
      return [];
    }

    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return [];
    const parsed = JSON.parse(text) as AiEnvelope;
    const rows = normalizeAiRows(parsed);
    const seen = new Set<string>();
    const deduped: ExpandedKeywordRow[] = [];
    for (const r of rows) {
      const k = normalizeKeywordForDedupe(r.phrase);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      deduped.push({
        phrase: r.phrase.trim(),
        intent: r.intent,
        cluster_hint: r.cluster_hint,
      });
    }

    return deduped;
  } catch (e) {
    console.warn("expandSeedKeywordsWithAi", e);
    return [];
  }
}
