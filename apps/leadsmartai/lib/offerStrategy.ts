import { dealCloserChat } from "@/lib/dealCloserOpenAI";

export type OfferStrategyInput = {
  listPrice: number;
  /** Buyer's hard ceiling, if any */
  budgetMax?: number;
  /** Recent closed comparable median (same segment) */
  comparablesMedian?: number;
  daysOnMarket: number;
  marketHeat: "hot" | "balanced" | "cool";
  /** How many competing known offers (0 if unknown) */
  competingOfferCount?: number;
  propertyAddress?: string;
  notes?: string;
};

export type OfferStrategyKind = "aggressive" | "balanced" | "conservative";

export type OfferStrategyResult = {
  recommendedPrice: number;
  strategy: OfferStrategyKind;
  confidence: number;
  reasoning: string;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Deterministic price & labels — used with or without AI narrative.
 */
export function computeOfferStrategyBase(input: OfferStrategyInput): Omit<OfferStrategyResult, "reasoning"> {
  const list = Math.max(0, input.listPrice);
  let target = list;

  const comps = input.comparablesMedian;
  if (comps && comps > 0) {
    const ratio = list / comps;
    if (ratio > 1.05) {
      target = list * 0.985;
      target = clamp(target, comps * 0.98, list);
    } else if (ratio < 0.95) {
      target = list * 1.01;
      target = clamp(target, list, comps * 1.04);
    }
  }

  const dom = Math.max(0, input.daysOnMarket);
  if (dom > 120) target *= 0.94;
  else if (dom > 60) target *= 0.97;
  else if (dom > 30) target *= 0.99;

  if (input.marketHeat === "hot") {
    target = target * 0.995 + list * 0.005;
  } else if (input.marketHeat === "cool") {
    target *= 0.985;
  }

  if (input.competingOfferCount && input.competingOfferCount >= 2) {
    target = target * 0.6 + list * 0.4;
  }

  if (input.budgetMax != null && input.budgetMax > 0) {
    target = Math.min(target, input.budgetMax);
  }

  target = Math.round(target);

  const pctOfList = list > 0 ? target / list : 1;
  let strategy: OfferStrategyKind = "balanced";
  if (pctOfList < 0.96) strategy = "aggressive";
  else if (pctOfList >= 0.995) strategy = "conservative";

  let confidence = 72;
  if (comps && comps > 0) confidence += 10;
  if (dom > 0) confidence += 5;
  if (input.marketHeat === "balanced") confidence += 3;
  if (input.competingOfferCount != null) confidence += 2;
  if (!comps) confidence -= 18;
  if (dom === 0) confidence -= 5;
  confidence = clamp(Math.round(confidence), 38, 94);

  return { recommendedPrice: target, strategy, confidence };
}

function fallbackReasoning(base: Omit<OfferStrategyResult, "reasoning">, input: OfferStrategyInput): string {
  const list = input.listPrice;
  const lines = [
    `Starting from a list of $${Math.round(list).toLocaleString()}, a ${input.marketHeat} market and ~${input.daysOnMarket} days on market suggest ${base.strategy === "aggressive" ? "room to anchor lower" : base.strategy === "conservative" ? "staying close to ask" : "a middle-ground first offer"}.`,
    base.recommendedPrice < list
      ? `First offer near $${base.recommendedPrice.toLocaleString()} preserves negotiation headroom while signaling seriousness.`
      : `A first offer at $${base.recommendedPrice.toLocaleString()} aligns with the pricing signals you provided.`,
    input.comparablesMedian
      ? `Comps around $${Math.round(input.comparablesMedian).toLocaleString()} anchor fair value — watch spread vs. your number.`
      : `Add comp support to tighten confidence; without median comps, appraisal and overpay risk are harder to judge.`,
  ];
  return lines.join(" ");
}

/**
 * Offer strategy engine — heuristic core + OpenAI reasoning when configured.
 */
export async function generateOfferStrategy(input: OfferStrategyInput): Promise<OfferStrategyResult> {
  const base = computeOfferStrategyBase(input);
  const fallback = fallbackReasoning(base, input);

  const ctx = JSON.stringify({
    listPrice: input.listPrice,
    budgetMax: input.budgetMax ?? null,
    comparablesMedian: input.comparablesMedian ?? null,
    daysOnMarket: input.daysOnMarket,
    marketHeat: input.marketHeat,
    competingOfferCount: input.competingOfferCount ?? null,
    address: input.propertyAddress ?? null,
    notes: input.notes ?? null,
    computed: base,
  });

  const ai = await dealCloserChat({
    system:
      "You are a senior residential real estate strategist helping buyer agents. Be practical, ethical, and concise. No legal advice.",
    user: `Given this JSON context, write 2–4 sentences of reasoning for the agent (not the client) explaining WHY the recommended first-offer posture makes sense and what to watch next. Do not contradict the recommendedPrice (${base.recommendedPrice}) or strategy label (${base.strategy}).

Context:
${ctx}`,
    temperature: 0.4,
    maxTokens: 350,
  });

  return {
    ...base,
    reasoning: ai || fallback,
  };
}
