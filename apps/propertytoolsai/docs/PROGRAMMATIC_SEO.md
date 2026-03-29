# Programmatic SEO engine (`/tool/[toolSlug]/[locationSlug]`)

## Overview

- **URLs:** `/tool/<tool-slug>/<location-slug>` (e.g. `/tool/cap-rate-calculator/los-angeles-ca`).
- **Scale:** `PROGRAMMATIC_SEO_TOOLS.length × PROGRAMMATIC_SEO_LOCATIONS.length` static pages (1,000+).
- **Content:** Template fallback always; optional **OpenAI** when `PROGRAMMATIC_SEO_AI=true` + `OPENAI_API_KEY` (cached 7 days via `unstable_cache`).

## Files

| Area | Path |
|------|------|
| Tool list | `lib/programmaticSeo/tools.ts` |
| Locations | `lib/programmaticSeo/locations.ts` (extends `TRAFFIC_CITIES`) |
| Fallback copy | `lib/programmaticSeo/fallbackContent.ts` |
| OpenAI | `lib/programmaticSeo/aiGenerate.ts` |
| Cache + loader | `lib/programmaticSeo/getPageContent.ts` |
| Page | `app/tool/[toolSlug]/[locationSlug]/page.tsx` |
| JSON API | `GET /api/seo/programmatic-content?tool=&location=` |
| Sitemap | `app/sitemap.ts` includes all `/tool/...` paths |

## Environment

```env
OPENAI_API_KEY=sk-...
# Optional:
PROGRAMMATIC_SEO_AI=true
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## Expand pages

1. Add a row to `PROGRAMMATIC_SEO_TOOLS` (slug must match an existing `app/<slug>/page.tsx` route).
2. Add cities to `EXTRA` in `lib/programmaticSeo/locations.ts` (or extend `TRAFFIC_CITIES` in `lib/trafficSeo.ts`).

## Smoke check

```bash
curl "http://localhost:3001/api/seo/programmatic-content?tool=mortgage-calculator&location=austin-tx"
```

## Build note

With `PROGRAMMATIC_SEO_AI` off (default), builds use deterministic copy only—no OpenAI at build time. Turning AI on will populate cache on first request per `(tool, location)` (or first render that executes the cached function).
