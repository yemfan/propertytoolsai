export type { CompetitorAnalysisConfig, KeywordOpportunity, ScrapedPage, ExtractedKeyword } from "./types";
export { normalizeCompetitorDomain, originFromDomain } from "./domain";
export { discoverSitemapUrls } from "./sitemap";
export { fetchPageHtml, parseHtmlToScrapedPage } from "./scrapeHtml";
export { extractKeywordsWithAi } from "./aiExtractKeywords";
export { extractKeywordsHeuristic } from "./heuristicKeywords";
export { aggregateExtractions, findGaps } from "./gapAnalysis";
export { scoreOpportunity, normalizedKey } from "./opportunityScore";
export {
  fetchOurKeywordCatalogNormalized,
  insertCompetitorRun,
  finalizeCompetitorRun,
  upsertCompetitorPage,
  insertCompetitorKeywordsBatch,
  insertOpportunityRows,
  listOpportunitiesForRun,
} from "./db";
export { runCompetitorAnalysis } from "./pipeline";
export type { CompetitorAnalysisResult } from "./pipeline";
export {
  feedOpportunitiesToKeywordDiscovery,
  materializeGuidesFromOpportunities,
} from "./integratePageGenerator";
