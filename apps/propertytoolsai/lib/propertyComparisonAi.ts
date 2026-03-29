/**
 * Server-only OpenAI helper for property comparison narratives.
 */

import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import type { PropertyInput } from "@/lib/propertyScoring";
import type { PropertyScoreResult } from "@/lib/propertyScoring";

export type AiComparisonResult = {
  bestPropertyId: string;
  explanation: string;
  pros: string[];
  cons: string[];
};

const SYSTEM_PROMPT = `You are a real estate investment analyst. Compare properties using the structured data and scores provided.
Respond ONLY with valid JSON (no markdown) in this exact shape:
{
  "bestPropertyId": "<id from input>",
  "explanation": "<2-4 sentences>",
  "pros": ["<string>", "..."] ,
  "cons": ["<string>", "..."]
}
Be objective; mention trade-offs. If data is thin, say so briefly.`;

export async function runPropertyComparisonAi(
  items: Array<{ property: PropertyInput; score: PropertyScoreResult }>
): Promise<AiComparisonResult> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) {
    throw new Error("AI is not configured (missing OPENAI_API_KEY).");
  }

  const payload = items.map((row, i) => ({
    index: i,
    id: row.property.id,
    address: row.property.address,
    price: row.property.price,
    beds: row.property.beds,
    baths: row.property.baths,
    sqft: row.property.sqft,
    rentMonthly: row.property.rentMonthly ?? null,
    pricePerSqft: row.score.metrics.pricePerSqft,
    estimatedRoiPct: row.score.metrics.estimatedAnnualRoiPct,
    investmentScore: row.score.total,
    breakdown: row.score.breakdown,
  }));

  const userPrompt = `Compare these properties and recommend the best investment. Explain clearly.

${JSON.stringify(payload, null, 2)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 900,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("Empty AI response.");

  let parsed: AiComparisonResult;
  try {
    parsed = JSON.parse(raw) as AiComparisonResult;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI response was not valid JSON.");
    parsed = JSON.parse(jsonMatch[0]) as AiComparisonResult;
  }

  if (!parsed.bestPropertyId || !parsed.explanation) {
    throw new Error("AI response missing required fields.");
  }

  parsed.pros = Array.isArray(parsed.pros) ? parsed.pros : [];
  parsed.cons = Array.isArray(parsed.cons) ? parsed.cons : [];

  return parsed;
}
