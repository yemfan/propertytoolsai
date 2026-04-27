import "server-only";

import {
  suggestAllNegotiationResponses,
  type NegotiationContext,
} from "@/lib/negotiation";
import {
  generateOfferStrategy,
  type OfferStrategyInput,
  type OfferStrategyResult,
} from "@/lib/offerStrategy";
import { analyzeDealRisks, type DealRiskAssessment } from "@/lib/risk";

import {
  buildDealCoachActionPlan,
  buildHeadline,
} from "@/lib/dealCoach/buildActionPlan";
import type {
  DealCoachActionInput,
  DealCoachReport,
  DealStage,
} from "@/lib/dealCoach/types";

/**
 * Orchestrator: stitches the existing offer-strategy + risk + negotiation
 * libraries with the action-plan builder into one unified DealCoachReport.
 *
 * Each underlying library degrades gracefully when its inputs are missing
 * (e.g. no list price → null strategy; no recommended offer → null risks).
 * The action-plan builder then runs whatever risk signals were resolved
 * plus the agent-supplied stage/timing context.
 *
 * Doesn't talk to Supabase — caller passes raw inputs. The route handler
 * is the auth/entitlement boundary.
 */

export type DealCoachServiceInput = {
  stage: DealStage;
  /** Hours since the agent last took meaningful action — drives follow-up nudges. */
  hoursSinceLastAgentAction?: number;
  hoursSinceLastChange?: number;
  budgetTight?: boolean;

  /** Required for offerStrategy + risk; null when not provided. */
  listPrice?: number;
  budgetMax?: number;
  comparablesMedian?: number;
  daysOnMarket?: number;
  marketHeat?: "hot" | "balanced" | "cool";
  competingOfferCount?: number;

  propertyAddress?: string;
  buyerNotes?: string;
};

function canRunOfferStrategy(
  input: DealCoachServiceInput,
): input is DealCoachServiceInput &
  Pick<OfferStrategyInput, "listPrice" | "daysOnMarket" | "marketHeat"> {
  return (
    typeof input.listPrice === "number" &&
    input.listPrice > 0 &&
    typeof input.daysOnMarket === "number" &&
    typeof input.marketHeat === "string"
  );
}

export async function runDealCoach(
  input: DealCoachServiceInput,
): Promise<DealCoachReport> {
  // 1. Pricing strategy — only when we have the offer-strategy minimums.
  let strategy: OfferStrategyResult | null = null;
  if (canRunOfferStrategy(input)) {
    try {
      strategy = await generateOfferStrategy({
        listPrice: input.listPrice,
        budgetMax: input.budgetMax,
        comparablesMedian: input.comparablesMedian,
        daysOnMarket: input.daysOnMarket,
        marketHeat: input.marketHeat,
        competingOfferCount: input.competingOfferCount,
        propertyAddress: input.propertyAddress,
        notes: input.buyerNotes,
      });
    } catch (e) {
      console.warn("[deal-coach] offer-strategy failed", e);
    }
  }

  // 2. Risk pillars — only when both the list price and the recommended offer
  // are known. The recommended offer comes from strategy when available;
  // otherwise we use the list price as the proxy (correctly conservative —
  // every risk pillar will report higher overpay/appraisal risk).
  let risks: DealRiskAssessment | null = null;
  if (
    typeof input.listPrice === "number" &&
    typeof input.daysOnMarket === "number" &&
    typeof input.marketHeat === "string"
  ) {
    risks = analyzeDealRisks({
      listPrice: input.listPrice,
      recommendedOffer: strategy?.recommendedPrice ?? input.listPrice,
      comparablesMedian: input.comparablesMedian,
      daysOnMarket: input.daysOnMarket,
      marketHeat: input.marketHeat,
    });
  }

  // 3. Negotiation scripts — best-effort. Useful even without strategy/risks.
  let negotiation: DealCoachReport["negotiation"] = null;
  try {
    const ctx: NegotiationContext = {
      propertyAddress: input.propertyAddress,
      listPrice: input.listPrice,
      recommendedPrice: strategy?.recommendedPrice,
      strategy: strategy?.strategy,
      risks: risks ?? undefined,
      buyerNotes: input.buyerNotes,
    };
    negotiation = await suggestAllNegotiationResponses(ctx);
  } catch (e) {
    console.warn("[deal-coach] negotiation failed", e);
  }

  // 4. Action plan — the "do this now" list. Pure, fast, no I/O.
  const actionInput: DealCoachActionInput = {
    stage: input.stage,
    hoursSinceLastAgentAction: input.hoursSinceLastAgentAction,
    hoursSinceLastChange: input.hoursSinceLastChange,
    risks: risks ?? undefined,
    competingOfferCount: input.competingOfferCount,
    budgetTight: input.budgetTight,
  };
  const actionPlan = buildDealCoachActionPlan(actionInput);
  const headline = buildHeadline(actionInput);

  return {
    stage: input.stage,
    strategy,
    risks,
    negotiation,
    actionPlan,
    headline,
  };
}
