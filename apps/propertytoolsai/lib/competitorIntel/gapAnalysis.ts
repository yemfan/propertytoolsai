import { normalizeKeywordForDedupe } from "@/lib/keywordDiscovery/normalize";
import { assignClusterSlug } from "@/lib/keywordDiscovery/clusterAssign";
import { buildGuidePath } from "@/lib/clusterGenerator/slug";
import type { ExtractedKeyword, KeywordOpportunity } from "./types";
import { scoreOpportunity } from "./opportunityScore";

export type AggregatedCompetitorKeyword = {
  normalized: string;
  display: string;
  intent: ExtractedKeyword["intent"];
  maxRelevance: number;
  pageCount: number;
  refs: { url: string; title?: string | null }[];
};

/**
 * Merges per-page extractions into unique keywords with frequency + refs.
 */
export function aggregateExtractions(
  items: { url: string; title: string | null; keywords: ExtractedKeyword[] }[]
): AggregatedCompetitorKeyword[] {
  const map = new Map<string, AggregatedCompetitorKeyword>();

  for (const page of items) {
    for (const kw of page.keywords) {
      const normalized = normalizeKeywordForDedupe(kw.phrase);
      if (!normalized) continue;
      const prev = map.get(normalized);
      if (!prev) {
        map.set(normalized, {
          normalized,
          display: kw.phrase.trim(),
          intent: kw.intent,
          maxRelevance: kw.relevance,
          pageCount: 1,
          refs: [{ url: page.url, title: page.title }],
        });
      } else {
        prev.pageCount += 1;
        prev.maxRelevance = Math.max(prev.maxRelevance, kw.relevance);
        if (!prev.refs.some((r) => r.url === page.url)) {
          prev.refs.push({ url: page.url, title: page.title });
        }
        if (!prev.intent && kw.intent) prev.intent = kw.intent;
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Keywords competitor targets that we do not have in our catalog (normalized set).
 */
export function findGaps(
  aggregated: AggregatedCompetitorKeyword[],
  ourNormalizedKeywords: Set<string>,
  maxPages: number
): KeywordOpportunity[] {
  const candidates: KeywordOpportunity[] = [];

  const sorted = [...aggregated].sort((a, b) => b.maxRelevance * b.pageCount - a.maxRelevance * a.pageCount);

  for (const a of sorted) {
    if (ourNormalizedKeywords.has(a.normalized)) continue;

    const cluster_slug = assignClusterSlug(a.display, null);
    const suggested_guide_path = cluster_slug ? buildGuidePath(cluster_slug, "los-angeles-ca") : null;

    const opportunity_score = scoreOpportunity({
      phrase: a.display,
      aiRelevance: a.maxRelevance,
      pageCount: a.pageCount,
      maxPages,
    });

    candidates.push({
      normalized_keyword: a.normalized,
      display_keyword: a.display,
      opportunity_score,
      gap_type: "missing_in_catalog",
      gap_detail: "Not present in seo_keyword_candidates (normalized)",
      cluster_slug,
      suggested_guide_path,
      competitor_refs: a.refs.slice(0, 5),
      rank: 0,
    });
  }

  candidates.sort((a, b) => b.opportunity_score - a.opportunity_score);
  return candidates.map((g, i) => ({ ...g, rank: i + 1 }));
}
