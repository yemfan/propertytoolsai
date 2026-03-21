# Competitor Reverse Engineering Engine

Discover what **competitors** target by crawling their **sitemap** → **scraping** titles/headings/body → **AI keyword extraction** → **gap analysis** vs your `seo_keyword_candidates` catalog → **ranked opportunities** (with suggested cluster + `/guides/...` paths).

## Architecture (`lib/competitorIntel/`)

| Module | Role |
|--------|------|
| `domain.ts` | Normalize host (`example.com`). |
| `sitemap.ts` | Fetch `sitemap.xml` / index / `wp-sitemap.xml`; recurse into nested sitemaps; collect `<loc>` URLs. |
| `scrapeHtml.ts` | `fetch` + regex-based parse (title, h1–h3, text excerpt) — no extra npm deps. |
| `aiExtractKeywords.ts` | OpenAI JSON: keywords + intent + relevance per page. |
| `heuristicKeywords.ts` | Bigram fallback if API unavailable. |
| `gapAnalysis.ts` | Aggregate per-page keywords; **gaps** = not in our normalized catalog. |
| `opportunityScore.ts` | Score from AI relevance, cross-page frequency, cluster fit. |
| `db.ts` | Supabase persistence. |
| `pipeline.ts` | `runCompetitorAnalysis(domain, config)`. |
| `integratePageGenerator.ts` | `feedOpportunitiesToKeywordDiscovery`, `materializeGuidesFromOpportunities`. |

## Database

Apply: `supabase/migrations/20260405_competitor_reverse_engine.sql`

- `seo_competitor_analysis_runs`
- `seo_competitor_pages`
- `seo_competitor_keywords`
- `seo_keyword_opportunities`

**Prerequisite:** `seo_keyword_candidates` (keyword discovery migration) should exist so gaps are meaningful.

## API

`POST /api/seo/competitor/analyze`

```json
{
  "domain": "competitor.com",
  "maxPages": 20,
  "maxSitemapUrls": 120,
  "crawlDelayMs": 400
}
```

- Long-running (serverless `maxDuration` set to 300s where supported).
- Respect `robots`/ToS in production; this is a technical baseline.

## Integration

```ts
import {
  runCompetitorAnalysis,
  feedOpportunitiesToKeywordDiscovery,
  materializeGuidesFromOpportunities,
} from "@/lib/competitorIntel";

const analysis = await runCompetitorAnalysis("example.com", { maxPages: 15 });
if (analysis.runId) {
  await feedOpportunitiesToKeywordDiscovery(analysis.runId, { topN: 20 });
  await materializeGuidesFromOpportunities(analysis.runId, { topClusters: 3, locationLimit: 2 });
}
```

## Env

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Keyword extraction (heuristic fallback if missing). |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for persistence. |
| `COMPETITOR_CRAWL_DELAY_MS` | Default delay between page fetches (politeness). |

## Ethics & risk

- Only analyze domains you are allowed to access; add rate limits; consider `robots.txt` in a future iteration.
- Competitor content is **not** stored in full — only excerpts + extracted keywords.
