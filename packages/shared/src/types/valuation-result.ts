import type { ValuationConfidenceLabel } from "../constants/valuation-confidence";

export type ValuationResultId = string;

/**
 * Persisted valuation snapshot for CRM / mobile lists (not the full CMA engine graph).
 * For engine output, see {@link ValuationEngineResult}.
 */
export type ValuationResult = {
  id: ValuationResultId;
  leadId: string | null;
  propertyAddress: string | null;
  city: string | null;
  state: string | null;
  estimatedValue: number | null;
  lowEstimate: number | null;
  highEstimate: number | null;
  confidenceLabel: ValuationConfidenceLabel | null;
  asOf: string | null;
  modelVersion: string | null;
  notes: string | null;
};
