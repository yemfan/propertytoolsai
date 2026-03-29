# Deal prediction engine (3–6 month likelihood)

## 1. Schema (`public.leads`)

| Column | Type | Purpose |
|--------|------|---------|
| `prediction_score` | `smallint` nullable | 0–100 rules-based score |
| `prediction_label` | `text` nullable | `low` (&lt;40), `medium` (40–69), `high` (≥70) |
| `prediction_factors` | `jsonb` | Explainable breakdown (array of factor objects) |
| `prediction_computed_at` | `timestamptz` | Last computation time |

Migration: `supabase/migrations/20260461000000_deal_prediction_engine.sql`

**Note:** This is separate from `lead_scores` (LLM-style intent/timeline) and `leads.score` (marketplace pricing). Deal prediction is deterministic and auditable via `prediction_factors`.

## 2. Scoring logic

- **Module:** `lib/dealPrediction/computeScore.ts`
- **Window:** Last **90 days** for SMS/email counts and `lead_events`.
- **Factors (max points):** engagement history (18), SMS/email activity (22), recency (18), property value signal (12), ownership duration (10), lead source (8), behavior + AI corroboration (12). **Total cap = 100.**

Each factor returns plain-English `detail` strings for CRM/tooling.

## 3. Service layer

- **Module:** `lib/dealPrediction/service.ts`
- **Functions:**
  - `buildDealPredictionInput(leadId)` — loads lead + counts + latest `lead_scores.score`
  - `computeDealPrediction(input)` — pure (re-exported from compute module)
  - `recomputeDealPredictionForLead(leadId)` — compute + `UPDATE leads`
  - `recomputeDealPredictionsForAgent(agentId, limit?)` — batch (cron / admin)
  - `listHighProbabilityLeads({ agentId, minScore?, label?, limit? })` — query helper

## 4. API routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/leads/deal-prediction` | Agent session | High-probability list (`minScore`, `label`, `limit`) |
| POST | `/api/dashboard/leads/[id]/deal-prediction/recompute` | Agent session | Recompute one lead (must own) |
| POST | `/api/admin/deal-prediction/recompute` | User + agent (or admin `allAgents`) | Batch recompute |

**Dashboard list filter:** `GET /api/dashboard/leads?filter=high_deal_potential` → `prediction_score >= 70`.

**Mobile list filter:** `GET /api/mobile/leads?filter=high_deal_potential` (same threshold).

## 5. Integration notes

### Re-engagement

- `lib/reengagement/service.ts` loads `prediction_score` / `prediction_label` and **sorts leads descending by score** before walking the cold sequence, so higher deal potential is touched first within `max_per_run`.
- After a **successful** re-engagement send, the service **fires a non-blocking** `recomputeDealPredictionForLead(leadId)` so scores refresh after a new touchpoint (failures are ignored to keep the job fast).

### Operations

1. Apply the Supabase migration.
2. Run an initial batch: `POST /api/admin/deal-prediction/recompute` with `{ "limit": 500 }` (or cron the same).
3. Optionally schedule daily/hourly batch recomputation; real-time precision is not required for this rules engine.

### Tuning

- Adjust weights and copy in `computeScore.ts` only; keep factor IDs stable if you persist analytics elsewhere.
- To incorporate new signals, extend `DealPredictionInput`, add a factor in `computeDealPrediction`, and populate the input in `buildDealPredictionInput`.

### Shared types

`@leadsmart/shared`: `DealPredictionLabel`, `DealPredictionFactor`, `DealPredictionResult`; CRM rows include optional `prediction_*` fields.
