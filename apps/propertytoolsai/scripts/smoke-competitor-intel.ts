/**
 * Competitor intel smoke: DB tables + tiny crawl (loads .env.local first).
 *
 *   npx tsx scripts/smoke-competitor-intel.ts
 *
 * Requires: migration 20260405 + keyword_discovery (for gap catalog).
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { runCompetitorAnalysis } = await import("../lib/competitorIntel/pipeline");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);
  for (const table of [
    "seo_competitor_analysis_runs",
    "seo_competitor_pages",
    "seo_competitor_keywords",
    "seo_keyword_opportunities",
  ]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.error(`Table ${table}:`, error.message, "\nApply migration 20260405_competitor_reverse_engine.sql");
      process.exitCode = 1;
      return;
    }
    console.log("OK ", table);
  }

  console.log("\nLocal sanity (parse + aggregate + gaps, no network)...\n");
  const { parseHtmlToScrapedPage } = await import("../lib/competitorIntel/scrapeHtml");
  const { extractKeywordsHeuristic } = await import("../lib/competitorIntel/heuristicKeywords");
  const { aggregateExtractions, findGaps } = await import("../lib/competitorIntel/gapAnalysis");

  const sampleHtml = `<!DOCTYPE html><html><head><title>Rental Cap Rate Calculator Tips</title></head><body>
    <h1>Cap rate for rental properties</h1><h2>How investors use cap rates</h2><p>Content about markets.</p></body></html>`;
  const scraped = parseHtmlToScrapedPage("https://example.com/cap-rate", sampleHtml);
  const heur = extractKeywordsHeuristic({ title: scraped.title, headings: scraped.headings });
  const agg = aggregateExtractions([
    {
      url: "https://example.com/cap-rate",
      title: scraped.title,
      keywords: heur,
    },
  ]);
  const gaps = findGaps(agg, new Set(), 5);
  if (agg.length === 0 || gaps.length === 0) {
    console.error("FAIL: expected aggregated keywords and at least one gap when catalog is empty");
    process.exitCode = 1;
    return;
  }
  console.log("OK  local pipeline:", "aggregated", agg.length, "gaps", gaps.length);

  console.log("\nRunning mini analysis (example.com, maxPages=2)...\n");

  const result = await runCompetitorAnalysis("example.com", {
    maxPages: 2,
    maxSitemapUrls: 20,
    crawlDelayMs: 100,
  });

  if (result.error) {
    console.error("Error:", result.error);
    process.exitCode = 1;
    return;
  }

  console.log("runId:", result.runId);
  console.log("pagesCrawled:", result.pagesCrawled, "keywordsExtracted:", result.keywordsExtracted);
  console.log("opportunities:", result.opportunities.length);
  if (result.opportunities[0]) {
    console.log("top:", result.opportunities[0].display_keyword, "score:", result.opportunities[0].opportunity_score);
  }
  if (result.keywordsExtracted === 0 && result.pagesCrawled > 0) {
    console.log(
      "\nNote: Crawl ran but no keywords (often HTTPS/TLS issues in local Node on Windows: 'unable to get local issuer certificate'). Local sanity above still validated the pipeline.\n"
    );
  }
  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
