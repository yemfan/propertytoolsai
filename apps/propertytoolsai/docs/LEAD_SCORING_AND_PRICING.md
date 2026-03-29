# Lead scoring & pricing (rules engine)

## Database

Apply Supabase migrations (includes `20260316_leads_score_price_fields.sql`):

- `score` (int, 0–100)
- `price` (numeric)
- `intent`, `timeframe`, `property_value`, `location`, `tool_used` (see migration)

## Code

Shared logic lives in **`packages/lead-marketplace`** (`@repo/lead-marketplace`). Apps re-export from `lib/scoring.ts` / `lib/pricing.ts` / `lib/engines/leadMarketplaceEngine.ts`.

| Location | Purpose |
|----------|---------|
| `packages/lead-marketplace/src/scoring.ts` | `calculateLeadScore(lead)` — rubric |
| `packages/lead-marketplace/src/pricing.ts` | `calculateLeadPrice(score, options?)` — tiers + CA/NY + high-value property |
| `lib/leadScorePipeline.ts` (per app) | After insert: update `leads`, emit `events` (`lead_scored`, `price_assigned`) |
| `packages/lead-marketplace/src/engine.ts` | `LeadMarketplaceEngine` + `rulesMarketplaceEngine` (swap for ML later) |

## API

- `POST /api/leads/:id/score` — recompute score/price for an existing lead.

## Tests

```bash
npm run test -w propertytoolsai
```
