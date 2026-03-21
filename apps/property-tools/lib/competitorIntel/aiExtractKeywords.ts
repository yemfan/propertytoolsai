import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import { parseIntent } from "@/lib/keywordDiscovery/intent";
import type { ExtractedKeyword } from "./types";

type AiRow = { phrase: string; intent?: string; relevance?: number };

function normalizeRows(raw: unknown): ExtractedKeyword[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = Array.isArray(o.keywords) ? o.keywords : [];
  const out: ExtractedKeyword[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as AiRow;
    const phrase = String(r.phrase ?? "").trim();
    if (!phrase || phrase.length > 120) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const intent = parseIntent(r.intent) ?? null;
    const relevance = Math.min(100, Math.max(0, Number(r.relevance ?? 70)));
    out.push({ phrase, intent, relevance: Number.isFinite(relevance) ? relevance : 70 });
  }
  return out;
}

/**
 * Extracts search-intent keywords from page title + headings + excerpt.
 */
export async function extractKeywordsWithAi(input: {
  url: string;
  title: string | null;
  headings: string[];
  textExcerpt: string;
  maxKeywords?: number;
}): Promise<ExtractedKeyword[]> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return [];

  const maxK = Math.min(input.maxKeywords ?? 35, 80);
  const headingBlock = input.headings.slice(0, 15).join("\n");
  const body = input.textExcerpt.slice(0, 8000);

  const prompt = `You are an SEO strategist. Given a competitor page, list search keywords they likely target.

URL: ${input.url}
Title: ${input.title ?? "—"}
Headings:
${headingBlock}

Content excerpt:
${body}

Return JSON only:
{ "keywords": [ { "phrase": string, "intent": "tool" | "informational" | "comparison", "relevance": number } ] }

Rules:
- ${maxK} phrases max, distinct, no duplicates.
- "relevance" 0-100 how valuable the keyword is commercially/informationally for real estate.
- Phrases are what users type in Google (2-8 words typical).`;

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
          { role: "system", content: "JSON only. No markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("competitor AI keyword extract", res.status, json);
      return [];
    }

    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return [];
    const parsed = JSON.parse(text) as unknown;
    return normalizeRows(parsed);
  } catch (e) {
    console.warn("extractKeywordsWithAi", e);
    return [];
  }
}
