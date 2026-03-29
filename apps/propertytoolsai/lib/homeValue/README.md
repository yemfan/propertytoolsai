# Home value domain (`lib/homeValue/`)

Canonical TypeScript modules for the estimator. Docs sometimes refer to **`/lib/home-value/`** — use the barrel **`@/lib/home-value`** for re-exports of the same symbols.

| Concept | File |
|--------|------|
| Types & API shapes | `types.ts` |
| Address / normalization | `normalizeProperty.ts` |
| Pipeline orchestration | `runEstimate.ts` |
| Point estimate + adjustments | `estimateEngine.ts` |
| Confidence + band | `confidenceEngine.ts` |
| Intent scoring / resolution | `intentSignals.ts`, `intentInference.ts` |
| Recommendations | `recommendations.ts` |
| Lead gating helpers | `leadCapture.ts` |
| Engagement / lead score | `engagementScore.ts` |
| **UI state machine** | `estimateUiState.ts` |
| **Analytics event names** | `homeValueTracking.ts` |
| Trust-safe display copy | `estimateDisplay.ts` |
| Session / DB writes | `funnelPersistence.ts` |

API route handlers live under **`app/api/home-value-estimate`**, **`app/api/home-value/`** (session, unlock-report), with rewrites from `/api/home-value/estimate` as documented in `docs/HOME_VALUE_ENGINE.md`.
