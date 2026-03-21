# Auto Cluster Generator

Programmatic **topic × location** SEO pages at `/guides/[topicSlug]/[locationSlug]`, targeting **1,000+ URLs** by combining **~20 cluster topics** with **`PROGRAMMATIC_SEO_LOCATIONS`** (~60 metros).

## Architecture

| Layer | Responsibility |
|--------|----------------|
| `lib/clusterGenerator/topics.ts` | Topic definitions: slug, name, **keywords**, **relatedSlugs** (internal links). |
| `lib/clusterGenerator/slug.ts` | Canonical path: `/guides/{topic}/{location}`. |
| `lib/clusterGenerator/internalLinks.ts` | Sibling topics in the **same city** → related guide links. |
| `lib/clusterGenerator/aiClusterContent.ts` | OpenAI JSON: title, meta, insights, sections, FAQs. |
| `lib/clusterGenerator/fallbackContent.ts` | Template content if AI off or unavailable. |
| `lib/clusterGenerator/db.ts` | Supabase: `seo_cluster_topics`, `seo_cluster_pages`, `seo_cluster_generation_runs`. |
| `lib/clusterGenerator/pipeline.ts` | `generateClusterPage`, `runDailyClusterBatch`, `pickMissingClusterCombinations`. |

**Keyword pipeline:** See [`KEYWORD_DISCOVERY.md`](./KEYWORD_DISCOVERY.md) — `getKeywordsForCluster`, `buildClusterPageGeneratorFeed`, and `generatePagesFromKeywordCluster()` connect discovery → guide URLs.

## Database

Apply: `supabase/migrations/20260402_seo_cluster_generator.sql`

- **seo_cluster_topics** — slug, name, keywords[], related_slugs[]
- **seo_cluster_pages** — unique (topic_slug, location_slug), title, meta_description, payload JSON, internal_links JSON
- **seo_cluster_generation_runs** — audit log for batches

## Environment

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Required for generate + page fetch. |
| `OPENAI_API_KEY` | Optional; fallback templates used if missing or `CLUSTER_AI=false`. |
| `CLUSTER_AI` | Set to `false` to force template-only generation. |
| `CLUSTER_DAILY_LIMIT` | Pages per cron run (default `25`). |
| `CLUSTER_BATCH_LIMIT` | Default for API `batch: true` (default `50`). |
| `CRON_SECRET` | Protects `/api/cron/cluster-generator` (shared with other crons). |

## APIs

### Generate

`POST /api/seo/cluster/generate`

**Single page**

```json
{ "topicSlug": "first-time-home-buyer-guide", "locationSlug": "los-angeles-ca", "force": true }
```

**Daily-style batch (same as cron)**

```json
{ "dailyBatch": true }
```

**Next N missing pairs**

```json
{ "batch": true, "limit": 100 }
```

### Cron (daily)

`GET /api/cron/cluster-generator` — optional `Authorization: Bearer CRON_SECRET` or `?secret=`.

## Scaling to 1,000+

- **Topics × locations** ≈ `20 × 60` = **1,200** URLs. Add rows to `CLUSTER_TOPICS` or insert into `seo_cluster_topics` and extend `CLUSTER_TOPICS` / code to match.
- Run batch or cron until `fetchExistingClusterPageKeys()` covers the matrix.
- **Sitemap** includes published `/guides/...` rows from the DB.

## Hub

- `/guides` — marketing hub with sample links.
- Deep pages **404** until generated — use API/cron to materialize rows.
