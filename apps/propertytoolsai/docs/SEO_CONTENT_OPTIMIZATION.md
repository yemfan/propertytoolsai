# AI Content Optimization Engine

Continuously improves programmatic SEO pages (`/tool/[toolSlug]/[locationSlug]`) using GSC-style metrics, rule-based actions, OpenAI, and Supabase overrides.

## Architecture

| Piece | Role |
|--------|------|
| `lib/seoOptimization/rules.ts` | Maps impressions, CTR, position → action (`rewrite_full`, `improve_title_meta`, `improve_content`, `add_faqs`, `none`). |
| `lib/seoOptimization/prompts.ts` | System + user prompts for JSON output (title, meta, body, FAQs, internal link hints). |
| `lib/seoOptimization/aiOptimizer.ts` | OpenAI call + validation. |
| `lib/seoOptimization/pipeline.ts` | Load base payload → classify → AI → `seo_content_overrides`. |
| `lib/seoOptimization/db.ts` | Supabase: metrics, overrides, runs, optional A/B titles. |
| `lib/programmaticSeo/getPageContent.ts` | Merges DB overrides ahead of cached base payload; exposes `seoMeta` for `generateMetadata`. |

## Database

Apply migration: `supabase/migrations/20260401_seo_content_optimization_engine.sql`

Tables:

- `seo_page_performance` — impressions, CTR, avg position per period.
- `seo_content_overrides` — published title, meta, full `payload_json` (insights, sections, FAQs).
- `seo_optimization_runs` — audit log.
- `seo_title_ab_variants` — optional A/B title storage + metrics (use `upsertTitleAbVariant`).

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Required for optimization runs. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required to read/write SEO tables (overrides skipped if unset at build time). |
| `PROGRAMMATIC_SEO_AI` | If `true`, pipeline uses AI for *base* payload before applying overrides (same as page cache). |
| `SEO_OPT_LOW_CTR` | Low CTR threshold (default `0.025`). |
| `SEO_OPT_LOW_RANK_POS` | Position above this → `rewrite_full` (default `30`). |
| `SEO_OPT_MID_RANK_MIN` / `SEO_OPT_MID_RANK_MAX` | Mid-rank band for `improve_content` (default `8`–`30`). |
| `SEO_OPT_WEEKLY_LIMIT` | Batch size for cron (default `50`). |
| `SEO_OPT_PAGE_KEYS` | Comma-separated `pageKey` list for batch (overrides DB discovery). |
| `SEO_OPT_INCLUDE_ALL_PAGES` | If `true`, weekly batch uses all programmatic pages when no metrics exist (uses `force` so classifier runs). |
| `CRON_SECRET` | If set, cron route requires `Authorization: Bearer …` or `?secret=`. |

## APIs

### Ingest metrics

`POST /api/seo/optimization/metrics`

```json
{
  "toolSlug": "cap-rate-calculator",
  "locationSlug": "los-angeles-ca",
  "impressions": 1200,
  "ctr": 0.018,
  "positionAvg": 14.2,
  "periodStart": "2025-02-01",
  "periodEnd": "2025-02-28"
}
```

Omitting `periodStart` / `periodEnd` defaults both to **today** (for stable upsert keys).

### Run optimizer

`POST /api/seo/optimization/run`

Single page:

```json
{ "toolSlug": "cap-rate-calculator", "locationSlug": "los-angeles-ca", "force": true }
```

Batch (weekly-style):

```json
{ "batch": true, "limit": 30, "force": false }
```

### Weekly cron

`GET /api/cron/seo-content-optimization`

Protect with `CRON_SECRET` in production. Optional query: `?limit=50&force=true`.

Schedule (e.g. Vercel cron): weekly, same route.

## Page keys

Format: `tool|{toolSlug}|{locationSlug}` — use `encodeProgrammaticPageKey()` / `decodeProgrammaticPageKey()`.

## A/B titles & internal links

- **A/B:** write competing titles to `seo_title_ab_variants`, rotate in experiments, feed metrics back via `upsertTitleAbVariant` or extend `loadProgrammaticSeoPage` to pick variant by cookie/header (future).
- **Internal links:** model returns `internal_link_suggestions`; wire into section copy or a small “Related” block as a follow-up.

## Related files

- `app/tool/[toolSlug]/[locationSlug]/page.tsx` — uses `seoMeta` from `loadProgrammaticSeoPage` for title/description.
- `app/api/seo/programmatic-content/route.ts` — debug payload (cached base only; use merged view via page or extend route if needed).
