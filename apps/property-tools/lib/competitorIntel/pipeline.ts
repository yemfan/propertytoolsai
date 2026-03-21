import { normalizeKeywordForDedupe } from "@/lib/keywordDiscovery/normalize";
import { extractKeywordsWithAi } from "./aiExtractKeywords";
import {
  fetchOurKeywordCatalogNormalized,
  finalizeCompetitorRun,
  insertCompetitorKeywordsBatch,
  insertCompetitorRun,
  insertOpportunityRows,
  upsertCompetitorPage,
} from "./db";
import { aggregateExtractions, findGaps } from "./gapAnalysis";
import { extractKeywordsHeuristic } from "./heuristicKeywords";
import { fetchPageHtml, parseHtmlToScrapedPage } from "./scrapeHtml";
import { discoverSitemapUrls } from "./sitemap";
import { normalizeCompetitorDomain } from "./domain";
import type { CompetitorAnalysisConfig, KeywordOpportunity } from "./types";

export type CompetitorAnalysisResult = {
  runId: string | null;
  domain: string;
  pagesCrawled: number;
  keywordsExtracted: number;
  opportunities: KeywordOpportunity[];
  error?: string;
};

export async function runCompetitorAnalysis(
  domainInput: string,
  options?: CompetitorAnalysisConfig
): Promise<CompetitorAnalysisResult> {
  const domain = normalizeCompetitorDomain(domainInput);
  const maxPages = Math.min(options?.maxPages ?? 25, 100);
  const maxSitemapUrls = options?.maxSitemapUrls ?? 150;
  const crawlDelayMs = options?.crawlDelayMs ?? Number(process.env.COMPETITOR_CRAWL_DELAY_MS ?? 350);
  const requestTimeoutMs = options?.requestTimeoutMs ?? 20000;

  const runInsert = await insertCompetitorRun({
    domain,
    config: { maxPages, maxSitemapUrls, crawlDelayMs },
  });

  if (runInsert.error || !runInsert.id) {
    return {
      runId: null,
      domain,
      pagesCrawled: 0,
      keywordsExtracted: 0,
      opportunities: [],
      error: runInsert.error ?? "Could not create run",
    };
  }

  const runId = runInsert.id;

  try {
    const ourKeywords = await fetchOurKeywordCatalogNormalized();

    const urls = await discoverSitemapUrls(domain, {
      maxUrls: maxSitemapUrls,
      timeoutMs: requestTimeoutMs,
      delayMs: crawlDelayMs,
    });

    const toCrawl = urls.slice(0, maxPages);
    const perPage: { url: string; title: string | null; keywords: import("./types").ExtractedKeyword[] }[] = [];

    for (const url of toCrawl) {
      if (crawlDelayMs) await new Promise((r) => setTimeout(r, crawlDelayMs));

      const { html, status, error: fetchErr } = await fetchPageHtml(url, requestTimeoutMs);
      if (!html) {
        await upsertCompetitorPage({
          run_id: runId,
          url,
          title: null,
          headings: [],
          text_excerpt: "",
          text_chars: 0,
          http_status: status || null,
          fetch_error: fetchErr ?? "empty html",
        });
        continue;
      }

      const scraped = parseHtmlToScrapedPage(url, html);
      const pageId = await upsertCompetitorPage({
        run_id: runId,
        url,
        title: scraped.title,
        headings: scraped.headings,
        text_excerpt: scraped.textExcerpt,
        text_chars: scraped.textChars,
        http_status: status,
        fetch_error: null,
      });

      let kws = await extractKeywordsWithAi({
        url,
        title: scraped.title,
        headings: scraped.headings,
        textExcerpt: scraped.textExcerpt,
      });

      if (kws.length === 0) {
        kws = extractKeywordsHeuristic({ title: scraped.title, headings: scraped.headings });
      }

      perPage.push({ url, title: scraped.title, keywords: kws });

      const kwRows = kws.map((k) => ({
        run_id: runId,
        page_id: pageId,
        normalized_keyword: normalizeKeywordForDedupe(k.phrase),
        display_keyword: k.phrase.trim(),
        intent: k.intent,
        extraction_score: k.relevance,
        source_page_url: url,
      })).filter((r) => r.normalized_keyword.length > 0);

      await insertCompetitorKeywordsBatch(kwRows);
    }

    const aggregated = aggregateExtractions(perPage.map((p) => ({ url: p.url, title: p.title, keywords: p.keywords })));

    const opportunities = findGaps(aggregated, ourKeywords, maxPages);

    await insertOpportunityRows(runId, opportunities);

    await finalizeCompetitorRun(runId, {
      pages_crawled: toCrawl.length,
      keywords_extracted: aggregated.length,
      opportunities_created: opportunities.length,
    });

    return {
      runId,
      domain,
      pagesCrawled: toCrawl.length,
      keywordsExtracted: aggregated.length,
      opportunities,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await finalizeCompetitorRun(runId, {
      pages_crawled: 0,
      keywords_extracted: 0,
      opportunities_created: 0,
      error: msg,
    });
    return {
      runId,
      domain,
      pagesCrawled: 0,
      keywordsExtracted: 0,
      opportunities: [],
      error: msg,
    };
  }
}
