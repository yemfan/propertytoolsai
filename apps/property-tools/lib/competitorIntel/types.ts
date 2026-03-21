import type { KeywordIntent } from "@/lib/keywordDiscovery/types";

export type ScrapedPage = {
  url: string;
  title: string | null;
  headings: string[];
  textExcerpt: string;
  textChars: number;
};

export type ExtractedKeyword = {
  phrase: string;
  intent: KeywordIntent | null;
  relevance: number;
};

export type KeywordOpportunity = {
  normalized_keyword: string;
  display_keyword: string;
  opportunity_score: number;
  gap_type: string;
  gap_detail: string | null;
  cluster_slug: string | null;
  suggested_guide_path: string | null;
  competitor_refs: { url: string; title?: string | null }[];
  rank: number;
};

export type CompetitorAnalysisConfig = {
  maxPages?: number;
  maxSitemapUrls?: number;
  crawlDelayMs?: number;
  requestTimeoutMs?: number;
};
