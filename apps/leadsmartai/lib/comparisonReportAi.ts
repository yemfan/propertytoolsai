/**
 * OpenAI narrative for comparison reports (server-only).
 */

import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import type { PropertyInput, PropertyScoreResult } from "@/lib/propertyScoring";

export type ComparisonAiOutput = {
  executive_summary: string;
  best_property_id: string;
  best_property_explanation: string;
  pros: string[];
  cons: string[];
};

const SYSTEM = `You are a senior real estate investment advisor writing a client-facing comparison report.
Respond ONLY with valid JSON (no markdown) in this exact shape:
{
  "executive_summary": "<2-4 sentences, professional tone>",
  "best_property_id": "<exact id from input>",
  "best_property_explanation": "<2-3 sentences why this property wins for investment>",
  "pros": ["<bullet>", "..."],
  "cons": ["<bullet>", "..."]
}
Be objective; mention trade-offs. If data is incomplete, note it briefly.`;

export async function generateComparisonReportAi(params: {
  client_name: string;
  scored: Array<{ property: PropertyInput; score: PropertyScoreResult }>;
}): Promise<ComparisonAiOutput> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) {
    throw new Error("AI is not configured (missing OPENAI_API_KEY).");
  }

  const payload = params.scored.map((row, i) => ({
    index: i,
    id: row.property.id,
    address: row.property.address,
    price: row.property.price,
    beds: row.property.beds,
    baths: row.property.baths,
    sqft: row.property.sqft,
    rent_monthly: row.property.rentMonthly ?? null,
    investment_score: row.score.total,
    price_per_sqft: row.score.metrics.pricePerSqft,
    estimated_roi_pct: row.score.metrics.estimatedAnnualRoiPct,
    breakdown: row.score.breakdown,
  }));

  const userPrompt = `Client name: ${params.client_name || "Client"}

Compare these properties and recommend the best investment. Explain clearly.

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
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM },
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

  let parsed: ComparisonAiOutput;
  try {
    parsed = JSON.parse(raw) as ComparisonAiOutput;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI response was not valid JSON.");
    parsed = JSON.parse(jsonMatch[0]) as ComparisonAiOutput;
  }

  if (!parsed.executive_summary || !parsed.best_property_id) {
    throw new Error("AI response missing required fields.");
  }

  parsed.pros = Array.isArray(parsed.pros) ? parsed.pros : [];
  parsed.cons = Array.isArray(parsed.cons) ? parsed.cons : [];

  return parsed;
}
