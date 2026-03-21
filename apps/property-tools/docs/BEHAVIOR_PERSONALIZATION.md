# Behavioral personalization

## Flow

1. **Track** — `lib/tracking.ts` exports `trackMortgageUsed`, `trackCmaUsed`, `trackPropertyViewed`, `trackComparisonStarted`, `trackAgentClicked`, plus optional helpers (`trackHomeValueUsed`, `trackCapRateUsed`, …). Each call appends to `localStorage` (`behaviorStore.ts`) and POSTs to `/api/analytics/track`.

2. **Profile** — `buildUserProfile(events)` in `lib/userProfile.ts` infers `intent`, `priceRange`, `location`, `urgency`.

3. **Recommendations** — `getNextBestActions(profile)` in `lib/recommendation.ts` returns prioritized actions with reasons.

4. **UI** — `components/NextSteps.tsx` on the home dashboard shows “Recommended for you”, calls `POST /api/ai/behavior-recommendations` when `OPENAI_API_KEY` is set for an optional narrative.

5. **Analytics** — `recommendation_shown`, `recommendation_clicked` via `trackEvent`.

## Wiring (examples)

- Mortgage calculator: `trackMortgageUsed` on load  
- Smart CMA: `trackCmaUsed` when a CMA completes  
- Home value: `trackPropertyViewed` + `trackHomeValueUsed` on run  
- AI comparison: `trackComparisonStarted` when ≥2 complete rows  
- Expert CTA: `trackAgentClicked`  
- Cap rate: `trackCapRateUsed` on load  
