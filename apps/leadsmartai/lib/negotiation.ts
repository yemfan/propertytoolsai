import { dealCloserChat } from "@/lib/dealCloserOpenAI";
import type { OfferStrategyResult } from "@/lib/offerStrategy";
import type { DealRiskAssessment } from "@/lib/risk";

export type NegotiationScenario = "counter_offer" | "multiple_offers" | "seller_pushback";

export type NegotiationSuggestion = {
  scenario: NegotiationScenario;
  suggestedScript: string;
  talkingPoints: string[];
  pitfalls: string[];
};

const FALLBACK: Record<NegotiationScenario, NegotiationSuggestion> = {
  counter_offer: {
    scenario: "counter_offer",
    suggestedScript:
      "We really like the home and we're serious. Our offer reflects recent closed sales nearby and our financing timeline. Can we bridge the gap if we tighten inspection timelines and keep your preferred closing date?",
    talkingPoints: [
      "Anchor to comps, not list price.",
      "Trade price for certainty (shorter contingencies, strong earnest money).",
      "Confirm seller priorities: speed, rent-back, or minimal repairs.",
    ],
    pitfalls: [
      "Don't negotiate against yourself in email threads — one structured counter at a time.",
      "Avoid waiving protections you can't afford if appraisal or inspection goes sideways.",
    ],
  },
  multiple_offers: {
    scenario: "multiple_offers",
    suggestedScript:
      "We're positioned to perform: pre-underwritten financing, flexible closing, and clean terms. If helpful, we can match structure on your strongest offer while keeping our appraisal and inspection contingencies that protect both sides.",
    talkingPoints: [
      "Lead with reliability: proof of funds / strong DU or pre-approval letter.",
      "Use an escalation clause only if your buyer understands max exposure.",
      "Sweeten with non-price terms sellers value.",
    ],
    pitfalls: [
      "Blind escalation can overexpose max price — cap and verify evidence of competing offer if allowed in your market.",
      "Over-waiving contingencies in multi-offer frenzy increases catastrophic risk.",
    ],
  },
  seller_pushback: {
    scenario: "seller_pushback",
    suggestedScript:
      "We heard your concerns. Our number reflects what we can justify to the lender and our own risk tolerance. We're open to creative structure — closing date, personal property, or repair credits — if that helps us meet in the middle without stretching beyond what the appraisal can support.",
    talkingPoints: [
      "Separate ego from economics — restate shared goal: closed sale.",
      "Offer tiered concessions (small credit vs. price move).",
      "If stuck, propose split-the-difference with a deadline for response.",
    ],
    pitfalls: [
      "Don't accept verbal counterterms without written amendment.",
      "Watch for seller trying to reopen non-price items already settled.",
    ],
  },
};

export type NegotiationContext = {
  propertyAddress?: string;
  listPrice?: number;
  recommendedPrice?: number;
  strategy?: OfferStrategyResult["strategy"];
  risks?: DealRiskAssessment;
  buyerNotes?: string;
};

/**
 * Negotiation assistant — OpenAI drafting when configured, else playbook fallbacks.
 */
export async function suggestResponse(
  scenario: NegotiationScenario,
  context: NegotiationContext = {}
): Promise<NegotiationSuggestion> {
  const base = FALLBACK[scenario];
  const blob = JSON.stringify({
    scenario,
    propertyAddress: context.propertyAddress ?? null,
    listPrice: context.listPrice ?? null,
    recommendedPrice: context.recommendedPrice ?? null,
    strategy: context.strategy ?? null,
    risks: context.risks
      ? {
          overpay: context.risks.overpay.level,
          appraisal: context.risks.appraisal.level,
          market: context.risks.market.level,
        }
      : null,
    buyerNotes: context.buyerNotes ?? null,
  });

  const raw = await dealCloserChat({
    system: `You help real estate agents negotiate. Return ONLY valid JSON with keys:
suggestedScript (string, 2–4 sentences, professional tone for agent to adapt for their buyer),
talkingPoints (array of 3 short strings),
pitfalls (array of 2 short strings).
No markdown.`,
    user: `Scenario: ${scenario.replace(/_/g, " ")}.\nContext JSON:\n${blob}`,
    temperature: 0.45,
    maxTokens: 500,
    jsonMode: true,
  });

  if (!raw) {
    return { ...base };
  }

  try {
    const parsed = JSON.parse(raw) as {
      suggestedScript?: string;
      talkingPoints?: string[];
      pitfalls?: string[];
    };
    return {
      scenario,
      suggestedScript: String(parsed.suggestedScript || base.suggestedScript),
      talkingPoints: Array.isArray(parsed.talkingPoints) && parsed.talkingPoints.length
        ? parsed.talkingPoints.map(String)
        : base.talkingPoints,
      pitfalls: Array.isArray(parsed.pitfalls) && parsed.pitfalls.length
        ? parsed.pitfalls.map(String)
        : base.pitfalls,
    };
  } catch {
    return { ...base };
  }
}

export async function suggestAllNegotiationResponses(
  context: NegotiationContext
): Promise<Record<NegotiationScenario, NegotiationSuggestion>> {
  const scenarios: NegotiationScenario[] = [
    "counter_offer",
    "multiple_offers",
    "seller_pushback",
  ];
  const entries = await Promise.all(
    scenarios.map(async (s) => [s, await suggestResponse(s, context)] as const)
  );
  return Object.fromEntries(entries) as Record<NegotiationScenario, NegotiationSuggestion>;
}
