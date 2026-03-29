# AI Deal Closer (LeadSmart AI)

## Route

- **UI:** `/deal-assistant` (requires login via `RequireAuthGate`)
- **API:** `POST /api/deal-assistant/analyze`

## Libraries

| File | Role |
|------|------|
| `lib/offerStrategy.ts` | `generateOfferStrategy(input)` — recommended price, posture, confidence + reasoning |
| `lib/risk.ts` | `analyzeDealRisks(input)` — overpay, appraisal, market pillars |
| `lib/negotiation.ts` | `suggestResponse(scenario)`, `suggestAllNegotiationResponses(context)` |
| `lib/offerGenerator.ts` | `generateOfferTerms(input, strategy)` — structured terms + cover-letter bullets |
| `lib/dealCloserOpenAI.ts` | Shared OpenAI chat helper (server-only) |

## AI

Set `OPENAI_API_KEY` (optional `OPENAI_MODEL`). Without a key, heuristics + built-in fallbacks still run.

## Disclaimer

Outputs are decision-support only, not legal or financial advice. Agents must follow brokerage policy and local contract rules.
