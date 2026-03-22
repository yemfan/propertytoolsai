# Home Value Estimate engine

## Modules (`lib/homeValue/`)

| File | Role |
|------|------|
| `types.ts` | `NormalizedProperty`, API request/response shapes, intent |
| `estimateEngine.ts` | Baseline $/sqft × sqft + multiplicative adjustments (type, beds/baths, age, lot, condition, renovation, trend) |
| `confidenceEngine.ts` | Score 0–100 + range band % from address quality, field completeness, comp coverage, DOM/trend |
| `normalizeProperty.ts` | Merges warehouse row + client overrides + missing-field list |
| `recommendations.ts` | Seller / buyer / investor next-step links |

## API

`POST /api/home-value-estimate`

- Enrichment: `getPropertyData` → warehouse row; `getComparables` for sold PPSF; `getCityData` for ZIP/city median and trend.
- Baseline PPSF: **comps** (if sold prices present) else **city** median PPSF else **245** fallback.
- Guests allowed (lead-gen).

## CRM / LeadSmart

Unlock flow uses `POST /api/leads/tool-capture` with:

- **`source`**: `home_value_estimator`
- **`tool`**: `home_value_estimator` (traffic_source: `home_value_estimator:home_value_estimator`)
- **`property_value`**, **`confidence_score`**, **`engagement_score`** (0–100; phone adds +3 on submit)
- **`metadata`**: `likely_intent` (seller | buyer | investor), estimate band, comps, `leadsmart_ready`

`notes` stores JSON for CRM intelligence. `recordLeadEvent` + `runLeadMarketplacePipeline` + `scoreLead` run on insert.

## UX

`components/homeValue/HomeValueTool.tsx`: address → instant estimate → refine (debounced) → gated full report → lead capture.
