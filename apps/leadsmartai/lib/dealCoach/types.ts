import type { DealRiskAssessment, RiskLevel } from "@/lib/risk";
import type { NegotiationSuggestion } from "@/lib/negotiation";
import type { OfferStrategyResult } from "@/lib/offerStrategy";

/**
 * AI Deal Coach types.
 *
 * The Deal Coach is an agent-facing surface that pulls together the existing
 * offer-strategy / risk / negotiation libraries into one unified per-deal
 * report. The leverage isn't new ML — it's coherent presentation: the agent
 * answers "what's the right next move on this deal?" without juggling four
 * separate tools.
 */

export type DealStage =
  | "drafting"
  | "sent"
  | "countered"
  | "accepted"
  | "rejected";

export type DealCoachActionPriority = "high" | "medium" | "low";

export type DealCoachAction = {
  /** Stable id for analytics + dedup. Don't rename. */
  id: string;
  priority: DealCoachActionPriority;
  /** Short imperative — "Send the offer", "Respond to seller counter". */
  title: string;
  /** One-sentence why. Why-now, not how-to. */
  rationale: string;
  /** Rough time estimate in minutes — sets agent expectations. */
  estimatedMinutes: number;
};

export type DealCoachActionPlan = {
  /** Sorted high → low. Multiple high-priority items are valid (deals can be on fire on multiple axes). */
  actions: DealCoachAction[];
};

/**
 * Inputs the action-plan builder needs. All optional so callers can pass
 * partial context — the builder just emits fewer / more generic actions
 * when context is missing rather than throwing.
 */
export type DealCoachActionInput = {
  stage: DealStage;
  /** Hours since the last meaningful state-change event (offer sent, counter received, etc.). */
  hoursSinceLastChange?: number;
  /** Hours since the agent last touched (sent / countered / followed-up). Drives follow-up nudges. */
  hoursSinceLastAgentAction?: number;
  /** Risks from `lib/risk.ts`. Used to surface protect-the-buyer actions. */
  risks?: DealRiskAssessment;
  /** Number of competing offers reported, if known. */
  competingOfferCount?: number;
  /** Buyer is at or near their hard ceiling. Drives walk-away / re-evaluate signals. */
  budgetTight?: boolean;
};

/**
 * The unified report. The orchestrator service builds this; the panel
 * renders it section-by-section.
 */
export type DealCoachReport = {
  stage: DealStage;
  /** Pricing recommendation. Empty when caller didn't supply enough offer-strategy inputs. */
  strategy: OfferStrategyResult | null;
  /** Risk pillars (overpay / appraisal / market). Same shape as lib/risk. */
  risks: DealRiskAssessment | null;
  /** Negotiation scripts for the three core scenarios. */
  negotiation: Record<string, NegotiationSuggestion> | null;
  /** Prioritized action list — the "do this now" view. */
  actionPlan: DealCoachActionPlan;
  /** Top-line summary the panel shows above all sections. */
  headline: string;
};

/** Helper exported so the panel can color risk pillars consistently. */
export const RISK_TONE: Record<RiskLevel, "emerald" | "amber" | "red"> = {
  low: "emerald",
  medium: "amber",
  high: "red",
};
