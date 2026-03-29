export type NormalizedLeadFields = {
  normalizedEmail?: string | null;
  normalizedPhone?: string | null;
  normalizedAddress?: string | null;
  contactCompletenessScore: number;
};

export type DuplicateMatchReason = {
  type: string;
  weight: number;
  detail: string;
};

export type DuplicateMatchCandidate = {
  primaryLeadId: string;
  duplicateLeadId: string;
  confidenceScore: number;
  reasons: DuplicateMatchReason[];
};

export type EnrichmentResult = {
  inferredContactType?: string | null;
  inferredLifecycleStage?: string | null;
  preferredContactChannel?: string | null;
  preferredContactTime?: string | null;
  notesSummary?: string | null;
  contactCompletenessScore: number;
  changes: Record<string, unknown>;
};

/** Minimal row shape for dedupe / normalization (maps from `leads`). */
export type LeadLike = Record<string, unknown>;
