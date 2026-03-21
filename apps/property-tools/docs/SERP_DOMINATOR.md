# SERP Dominator Engine

For a **single seed keyword**, generate **five page types** to own more SERP real estate: **tool**, **landing**, **blog**, **comparison**, **FAQ** — each with **type-specific AI prompts**, **featured-snippet blocks**, a **full internal-link mesh** across the cluster, **DB storage**, and optional **rank tracking**.

## URLs

- Hub: `/serp-hub`
- Pages: `/serp-hub/{keywordSlug}/{pageType}`  
  `pageType` ∈ `tool` | `landing` | `blog` | `comparison` | `faq`

`keywordSlug` is derived from the seed (lowercase, hyphenated).

## Database

Apply: `supabase/migrations/20260406_serp_dominator_engine.sql`

- `serp_dominator_campaigns` — **unique `keyword_slug`** (one active cluster per slug; upsert regenerates pages).
- `serp_dominator_pages` — content JSON, `snippet_blocks`, `internal_links` (mesh).
- `serp_rank_snapshots` — optional position tracking per `keyword_normalized` + `page_path` + date.

## APIs

| Endpoint | Purpose |
|----------|---------|
| `POST /api/seo/serp-dominator/generate` | Body: `{ "keyword": "...", "clusterHint?": "...", "siteOrigin?": "..." }` — creates/updates all 5 pages. **maxDuration 300s** (Vercel Pro). |
| `POST /api/seo/serp-dominator/rank-snapshot` | Body: `keyword`, `pagePath`, `position`, optional `source`, `notes`, `recordedAt`. |
| `GET /api/seo/serp-dominator/rank-snapshot?keyword=...` | Recent snapshots for normalized keyword. |

## Library (`lib/serpDominator/`)

- `prompts.ts` — one prompt template per page type.
- `aiGenerate.ts` — OpenAI JSON → title, meta, payload, snippet blocks.
- `snippetBlocks.ts` — normalize paragraph / bullets / definition blocks.
- `internalLinks.ts` — mesh links across all five URLs.
- `pipeline.ts` — `runSerpDominatorCampaign(seedKeyword)`.
- `integratePageGenerator.ts` — `runDiscoveryThenSerp`, `expandSeedsToSerpClusters`.

## Integration

```ts
import { runDiscoveryThenSerp } from "@/lib/serpDominator";

await runDiscoveryThenSerp("mortgage refinance calculator");
```

## Env

- `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (for absolute internal links in DB).

## Sitemap

Published `/serp-hub/...` paths are merged in `app/sitemap.ts`.
