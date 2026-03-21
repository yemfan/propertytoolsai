# Keyword Discovery Engine

Continuously expands **seed keywords** into **50+ variations per seed** (AI + heuristics), classifies **intent**, **scores**, **dedupes**, assigns **cluster slugs** (aligned with `CLUSTER_TOPICS`), and persists to Supabase for the **Auto Cluster Generator** and reporting.

## Flow

1. **Input** — `seeds: string[]`
2. **AI expansion** — OpenAI returns JSON `variations[]` with `phrase`, `intent`, optional `cluster_hint`
3. **Gap fill** — if fewer than `minPerSeed`, `expandSeedHeuristically()` adds deterministic phrases
4. **Intent** — `tool` | `informational` | `comparison` (AI + `classifyIntentHeuristic` fallback)
5. **Cluster** — `assignClusterSlug()` using hint + keyword overlap with `lib/clusterGenerator/topics.ts`
6. **Scoring** — `scoreKeyword()` (0–100 heuristic)
7. **Dedupe** — `normalizeKeywordForDedupe()` + keep max score per key
8. **Persist** — upsert `seo_keyword_candidates` (updates when new score is higher)

## Database

Migration: `supabase/migrations/20260403_keyword_discovery_engine.sql`

- `seo_keyword_discovery_runs` — batch metadata
- `seo_keyword_candidates` — unique `normalized_keyword`

## APIs

| Endpoint | Purpose |
|----------|---------|
| `POST /api/seo/keyword-discovery/run` | Body: `{ seeds, minPerSeed?, persist? }` |
| `GET /api/cron/keyword-discovery` | Daily; env `KEYWORD_DISCOVERY_SEEDS` or built-in defaults |

## Integration (page generator)

```ts
import {
  getKeywordsForCluster,
  buildClusterPageGeneratorFeed,
  generatePagesFromKeywordCluster,
} from "@/lib/keywordDiscovery";

// Prioritized keywords for a cluster
const kws = await getKeywordsForCluster("cap-rate-explained", 30);

// Feed rows with suggested /guides/... paths
const feed = await buildClusterPageGeneratorFeed({
  clusterSlug: "cap-rate-explained",
  keywordLimit: 20,
  maxLocations: 5,
});

// Generate actual guide pages (cluster × locations)
await generatePagesFromKeywordCluster({
  clusterSlug: "cap-rate-explained",
  locationLimit: 5,
  force: false,
});
```

## Env

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | AI expansion (heuristics still run if missing) |
| `KEYWORD_DISCOVERY_SEEDS` | Cron: comma-separated seeds |
| `KEYWORD_DISCOVERY_MIN_PER_SEED` | Cron query default (optional) |
| `CRON_SECRET` | Protects cron route |

## Library

`lib/keywordDiscovery/` — modular: `normalize`, `intent`, `clusterAssign`, `scoring`, `dedupe`, `aiExpansion`, `localExpansion`, `db`, `pipeline`, `integrateCluster`.
