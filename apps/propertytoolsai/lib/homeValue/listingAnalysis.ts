/**
 * LLM Listing Description Analysis — extracts value-relevant signals
 * from comparable sale listing text (e.g., "renovated kitchen", "as-is",
 * "water views", "estate sale") using gpt-4o-mini.
 *
 * Returns a structured quality/condition adjustment that the estimate
 * engine can fold into the comp weighting or the overall estimate.
 *
 * Cost-effective: batches up to 10 descriptions in one LLM call.
 * Graceful degradation: returns neutral adjustment when no descriptions
 * are available or when the OpenAI key is missing.
 */

import { getOpenAIConfig } from "@/lib/ai/openaiClient";

export type ListingSignal = {
  compId: string;
  /** -0.10 to +0.10 — how much this listing's description suggests
   *  the sale price was above/below true market value. */
  adjustmentPct: number;
  /** Human-readable reasons extracted from the listing text. */
  reasons: string[];
  /** Raw quality label from LLM. */
  quality: "premium" | "above_average" | "average" | "below_average" | "distressed";
};

export type ListingAnalysisResult = {
  signals: ListingSignal[];
  /** Average adjustment across all analyzed comps. */
  avgAdjustmentPct: number;
  /** Whether LLM was actually called (false when no descriptions or no API key). */
  analyzed: boolean;
};

const NEUTRAL_RESULT: ListingAnalysisResult = {
  signals: [],
  avgAdjustmentPct: 0,
  analyzed: false,
};

type CompDescription = {
  id: string;
  address: string;
  description: string;
  soldPrice: number;
};

/**
 * Analyze listing descriptions for value signals using LLM.
 * Pass up to 10 comp descriptions; batches into a single API call.
 *
 * Returns neutral result when:
 * - No descriptions provided
 * - OPENAI_API_KEY is not set
 * - LLM call fails
 */
export async function analyzeListingDescriptions(
  comps: CompDescription[]
): Promise<ListingAnalysisResult> {
  // Filter to comps that actually have descriptions
  const withDesc = comps.filter(
    (c) => c.description && c.description.trim().length > 20
  );

  if (withDesc.length === 0) return NEUTRAL_RESULT;

  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return NEUTRAL_RESULT;

  // Limit to 10 to keep costs/latency reasonable
  const batch = withDesc.slice(0, 10);

  const compList = batch
    .map(
      (c, i) =>
        `[${i + 1}] ID: ${c.id}\nAddress: ${c.address}\nSold: $${c.soldPrice.toLocaleString()}\nDescription: ${c.description.slice(0, 500)}`
    )
    .join("\n\n");

  const systemPrompt = `You are a real estate valuation analyst. Analyze comparable sale listing descriptions to identify signals that suggest the sale price was above or below true market value.

Positive signals (sale price likely above market): renovated, updated kitchen/bath, waterfront/views, pool, new roof, premium finishes, smart home, EV charger, solar panels, ADU/guest house.

Negative signals (sale price likely below market): as-is, estate sale, fixer-upper, needs work, bank-owned, REO, short sale, tenant-occupied, deferred maintenance, foundation issues, mold, fire damage.

For each comp, output a JSON object with:
- id: the comp ID
- quality: "premium" | "above_average" | "average" | "below_average" | "distressed"
- adjustmentPct: number between -0.10 and 0.10 (how much the sale price deviates from true market value due to these signals)
- reasons: array of 1-3 short reason strings

Respond with ONLY a JSON array of objects, no other text.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze these comparable sale listings:\n\n${compList}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[listingAnalysis] OpenAI API error: ${res.status}`);
      return NEUTRAL_RESULT;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Parse JSON response — handle markdown code blocks
    const jsonStr = content
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(jsonStr) as Array<{
      id: string;
      quality: string;
      adjustmentPct: number;
      reasons: string[];
    }>;

    if (!Array.isArray(parsed)) return NEUTRAL_RESULT;

    const signals: ListingSignal[] = parsed
      .filter((p) => p && typeof p.id === "string")
      .map((p) => ({
        compId: p.id,
        adjustmentPct: clamp(Number(p.adjustmentPct) || 0, -0.10, 0.10),
        reasons: Array.isArray(p.reasons)
          ? p.reasons.map(String).slice(0, 3)
          : [],
        quality: validateQuality(p.quality),
      }));

    const avgAdj =
      signals.length > 0
        ? signals.reduce((sum, s) => sum + s.adjustmentPct, 0) / signals.length
        : 0;

    return {
      signals,
      avgAdjustmentPct: Math.round(avgAdj * 1000) / 1000,
      analyzed: true,
    };
  } catch (e) {
    console.warn("[listingAnalysis] LLM analysis failed:", e);
    return NEUTRAL_RESULT;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function validateQuality(
  q: string
): ListingSignal["quality"] {
  const valid = ["premium", "above_average", "average", "below_average", "distressed"] as const;
  const normalized = String(q).toLowerCase().trim();
  for (const v of valid) {
    if (normalized === v) return v;
  }
  return "average";
}
