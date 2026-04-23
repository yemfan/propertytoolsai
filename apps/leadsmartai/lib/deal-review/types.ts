/**
 * Shared types for the AI deal-review feature.
 *
 * Snapshot is the structured input to Claude; Review is the
 * Claude-generated output. Both are persisted — snapshot inside the
 * review payload for provenance, review for the UI to render.
 */

import type { TransactionType } from "@/lib/transactions/types";

export type DealReviewSnapshot = {
  // Identity
  transactionId: string;
  transactionType: TransactionType;
  propertyAddress: string;
  purchasePrice: number | null;

  // Key dates — raw ISOs + derived "days from anchor" counters
  mutualAcceptanceDate: string | null;
  listingStartDate: string | null;
  closingDate: string | null;
  closingDateActual: string | null;

  daysOnMarket: number | null;
  daysMutualToClose: number | null;

  // Contingencies — planned vs actual completion days
  inspectionDeadlineDay: number | null;
  inspectionCompletedDay: number | null;
  appraisalDeadlineDay: number | null;
  appraisalCompletedDay: number | null;
  loanContingencyDeadlineDay: number | null;
  loanContingencyRemovedDay: number | null;

  // Task completion stats
  taskTotal: number;
  taskCompleted: number;
  taskOverdueAtClose: number;
  /** Tasks completed LATE (completed_at > due_date). */
  taskLateCount: number;
  /** Up to 5 of the most-late tasks, with how many days each slipped. */
  taskSlipSamples: Array<{ title: string; slipDays: number }>;

  // Counterparties count + basic mix
  counterpartyRoles: string[];

  // For listing-side: offer counts + price movement
  offerReceivedCount: number | null;
  offerAcceptedCount: number | null;
  offerAcceptedToListRatio: number | null; // accepted price / list price

  // Agent-wide baseline (for pattern-vs-my-other-deals commentary)
  agentAvgDaysMutualToClose: number | null;
  agentClosedCount: number;

  // Commission (agent's own revenue lens; sellers don't see the review)
  grossCommission: number | null;
  agentNetCommission: number | null;
};

export type DealReview = {
  /** Filled + locked once generated; UI shows "generated X ago". */
  generatedAtIso: string;
  /** 1-sentence headline of the deal. */
  headline: string;
  /** 2-3 sentence executive summary. */
  summary: string;
  whatWentWell: string[];
  whereItStalled: string[];
  patternObservations: string[];
  doDifferentlyNextTime: string[];
  /** Optional: Claude's 0-1 grade on agent execution. Missing = "no grade." */
  executionScore: number | null;
};
