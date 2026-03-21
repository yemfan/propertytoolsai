export type KeywordIntent = "tool" | "informational" | "comparison";

export type ExpandedKeywordRow = {
  phrase: string;
  intent: KeywordIntent;
  /** Optional slug from AI; validated against cluster catalog */
  cluster_hint?: string | null;
};

export type KeywordCandidate = {
  normalized_keyword: string;
  display_keyword: string;
  intent: KeywordIntent;
  score: number;
  cluster_slug: string | null;
  source_seed: string;
};

export type DiscoveryPipelineResult = {
  runId: string | null;
  seeds: string[];
  candidates: KeywordCandidate[];
  error?: string;
  /** After dedupe + DB merge stats */
  stats: {
    rawGenerated: number;
    afterDedupe: number;
    inserted: number;
    updated: number;
  };
};
