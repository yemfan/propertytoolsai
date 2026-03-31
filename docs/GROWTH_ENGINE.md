# Growth Engine (PropertyTools AI + LeadSmart AI)

## Package `@repo/growth`

- **`referral.ts`** — `generateReferralCode`, `normalizeReferralCode`, `extractReferralFromSearchParams`, etc.
- **`viral.ts`** — `computeViralMetrics` (heuristic viral coefficient from shares/signups).
- **`seo.ts`** — `GROWTH_SEO_TOOLS`, `GROWTH_SEO_CITIES` for programmatic SEO pages.

## Database (`20260331_growth_engine.sql`)

Apply in **both** app Supabase projects (or shared DB):

- **`shareable_results`** — tool output snapshots for `/result/[id]`.
- **`referral_codes`** — per-agent codes; counters for signups, conversions, shares.
- **`referral_events`** — event stream (`view` | `click` | `signup` | `conversion` | `share`).

### Verify migration (CLI)

After applying the migration, from repo root (use the app whose `.env.local` points at that database):

```bash
npm run smoke:growth-engine -w leadsmartai
# or
npm run smoke:growth-engine -w propertytoolsai
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in that app’s `.env.local`.

## APIs (each app)

| Path | Purpose |
|------|---------|
| `POST /api/growth/shareable-result` | Create share row → `{ sharePath: /result/:id }` |
| `POST /api/growth/shareable-result/[id]/view` | Increment view count |
| `POST /api/growth/referral/record` | Log referral event (requires known `code`) |
| `POST /api/growth/track` | `page_view` / `tool_usage` / `conversion` → `traffic_events` |
| `GET/POST /api/dashboard/growth/referral-code` | Agent: list / create codes |
| `GET /api/dashboard/growth/metrics` | Agent: traffic + referral + viral snapshot |

## Pages

- **`/result/[id]`** — Public shared result + progressive lead capture.
- **`/growth/seo/[tool]/[citySlug]`** — Static-generated local landing pages (tool × city matrix).
- **`/dashboard/growth`** — Analytics + referral code manager.

## Tracking

- Prefer **`/api/growth/track`** with `event_type: tool_usage` from calculators (client hook `useGrowthTrack`).
- Keep using **`/api/traffic/track`** if already integrated; growth metrics aggregate both patterns where `event_type` matches.

## Referral flow

1. Agent generates a code on **Dashboard → Growth**.
2. Append **`?ref=CODE`** to marketing links.
3. On landing, optionally `POST /api/growth/referral/record` with `{ code, event_type: "view" }`.
4. On signup, record `{ event_type: "signup" }` (and increment counters).

## Brands

- LeadSmart AI default brand: **`leadsmart`** in `shareable_results`.
- PropertyTools default brand: **`propertytools`**.
