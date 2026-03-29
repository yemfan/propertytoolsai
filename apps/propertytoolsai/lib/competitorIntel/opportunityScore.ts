import { assignClusterSlug } from "@/lib/keywordDiscovery/clusterAssign";
import { normalizeKeywordForDedupe } from "@/lib/keywordDiscovery/normalize";
import type { ExtractedKeyword } from "./types";

/**
 * Combines AI relevance, cross-page frequency, and cluster fit.
 */
export function scoreOpportunity(input: {
  phrase: string;
  aiRelevance: number;
  pageCount: number;
  maxPages: number;
}): number {
  const freq = Math.min(40, (input.pageCount / Math.max(1, input.maxPages)) * 40);
  const base = input.aiRelevance * 0.5 + freq;
  const cluster = assignClusterSlug(input.phrase, null);
  const clusterBoost = cluster ? 12 : 0;
  return Math.max(0, Math.min(100, Math.round((base + clusterBoost) * 10) / 10));
}

export function normalizedKey(phrase: string): string {
  return normalizeKeywordForDedupe(phrase);
}
