import "server-only";
import Anthropic from "@anthropic-ai/sdk";

import { buildFallbackCommentary } from "./fallback";
import type {
  DealAnalyzerInputs,
  DealAnalyzerMetrics,
  DealCommentary,
} from "./types";

/**
 * Generates AI-written deal commentary via Claude. Always falls back
 * to the deterministic rule-based reader if:
 *   - ANTHROPIC_API_KEY is missing
 *   - the SDK call errors (rate limit, timeout, etc.)
 *   - the response fails validation
 *
 * We never return null — the caller always gets a usable commentary.
 *
 * Cost: one ~1-2k token call per unique (inputs, metrics) pair. We
 * let the caller handle caching — see /api/ai-deal-analyzer/commentary.
 */
export async function generateDealCommentary(
  inputs: DealAnalyzerInputs,
  metrics: DealAnalyzerMetrics,
): Promise<DealCommentary> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return buildFallbackCommentary(inputs, metrics);
  }

  try {
    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(inputs, metrics);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      // Temperature tuned slightly above 0 so commentary isn't robotic
      // but stays grounded in the numbers. The prompt clamps form.
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return buildFallbackCommentary(inputs, metrics);
    }

    const parsed = parseCommentaryResponse(textBlock.text);
    if (!parsed) return buildFallbackCommentary(inputs, metrics);

    return { ...parsed, aiGenerated: true };
  } catch (err) {
    console.warn(
      "[aiDealAnalyzer] Claude call failed; using fallback:",
      err instanceof Error ? err.message : err,
    );
    return buildFallbackCommentary(inputs, metrics);
  }
}

const SYSTEM_PROMPT = `You are a seasoned real-estate investment analyst writing for a retail investor evaluating a rental property.

Rules:
- Ground every claim in the numbers you're given. Don't invent market data you don't have.
- Be direct and skeptical, not cheerleading. If a deal is weak, say so plainly.
- Prefer concrete guidance over generic advice.
- Keep each bullet under 20 words. Keep summary to 2-3 sentences.
- Output ONLY valid JSON matching the schema — no prose before or after, no markdown code fences.`;

function buildPrompt(
  inputs: DealAnalyzerInputs,
  metrics: DealAnalyzerMetrics,
): string {
  const addressLine = inputs.propertyAddress
    ? `Property: ${inputs.propertyAddress}`
    : "Property: (address not provided)";

  return [
    addressLine,
    "",
    "Deal inputs:",
    `- Purchase price: $${fmtInt(inputs.purchasePrice)}`,
    `- Down payment: ${inputs.downPaymentPercent}% ($${fmtInt(metrics.cashInvested)})`,
    `- Loan: $${fmtInt(metrics.loanAmount)} @ ${inputs.interestRate}% for ${inputs.loanTermYears} yrs`,
    `- Monthly rent: $${fmtInt(inputs.monthlyRent)}`,
    inputs.otherIncome ? `- Other monthly income: $${fmtInt(inputs.otherIncome)}` : null,
    `- Property tax: ${inputs.propertyTaxPercent}% of price/yr`,
    `- Insurance: $${fmtInt(inputs.insuranceMonthly)}/mo`,
    `- Maintenance reserve: ${inputs.maintenancePercent}% of rent`,
    `- Management: ${inputs.managementPercent}% of rent`,
    `- Vacancy: ${inputs.vacancyPercent}%`,
    "",
    "Computed metrics:",
    `- Monthly cash flow: $${fmtInt(metrics.monthlyCashFlow)}`,
    `- Annual cash flow: $${fmtInt(metrics.annualCashFlow)}`,
    `- Cap rate: ${metrics.capRate.toFixed(2)}%`,
    `- Cash-on-cash return: ${metrics.cashOnCashReturn.toFixed(2)}%`,
    `- Price-to-rent ratio: ${metrics.priceToRentRatio.toFixed(1)}`,
    "",
    "Task: return a JSON object matching this exact schema:",
    `{
  "dealScore": number (0-100, integer),
  "headline": string (under 60 chars, one-line summary),
  "summary": string (2-3 sentences, strategic read),
  "strengths": string[] (1-3 items, each under 20 words),
  "risks": string[] (1-3 items, each under 20 words),
  "nextMoves": string[] (1-3 items, each under 20 words, actionable)
}`,
    "",
    "Do NOT include markdown code fences or any text outside the JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Tolerant JSON parser. Claude sometimes wraps JSON in ```json fences
 * even when told not to, so strip those. Requires all fields present
 * and of the right type, otherwise returns null to trigger fallback.
 */
function parseCommentaryResponse(
  text: string,
): Omit<DealCommentary, "aiGenerated"> | null {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const dealScore = Number(parsed.dealScore);
    const headline = typeof parsed.headline === "string" ? parsed.headline : null;
    const summary = typeof parsed.summary === "string" ? parsed.summary : null;
    const strengths = asStringArray(parsed.strengths);
    const risks = asStringArray(parsed.risks);
    const nextMoves = asStringArray(parsed.nextMoves);

    if (
      !Number.isFinite(dealScore) ||
      !headline ||
      !summary ||
      !strengths.length ||
      !risks.length
    ) {
      return null;
    }

    return {
      dealScore: Math.max(0, Math.min(100, Math.round(dealScore))),
      headline: headline.slice(0, 120),
      summary: summary.slice(0, 500),
      strengths: strengths.slice(0, 3),
      risks: risks.slice(0, 3),
      nextMoves: nextMoves.slice(0, 3),
    };
  } catch {
    return null;
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim());
}

function fmtInt(n: number): string {
  return Number.isFinite(n)
    ? Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "0";
}
