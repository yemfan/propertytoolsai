# Environment variables (PropertyTools app)

## Where is `.env.local`?

Next.js loads env files from **this app folder**, not the monorepo root:

`apps/property-tools/.env.local`

There is **no** `.env.local` at `Propertytoolsai/` (repo root) for this app.

## Why you might not “see” it

1. **Gitignore** — `.env*.local` is listed in `.gitignore`, so the file is not committed. A fresh clone has no `.env.local` until you create it.
2. **IDE** — Some views hide gitignored files. In VS Code / Cursor: check **Explorer** settings for excluding gitignored files, or open the file directly (**File → Open File**) and paste:
   `apps/property-tools/.env.local`
3. **Windows Explorer** — Dotfiles are easy to miss; use “Show hidden files” if needed.

## Create it

From `apps/property-tools`:

```bash
copy .env.example .env.local
```

(PowerShell: `Copy-Item .env.example .env.local`)

Then fill in real values. For address autocomplete, set **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** (Places API + billing on that Google Cloud project).

**Duplicate keys:** If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` appears more than once, the **last** line wins. An empty second line will clear the key and break address suggestions.

## Product analytics & lead capture

Apply the migration in `supabase/migrations/20260315_product_events_and_lead_intent.sql` in the Supabase SQL editor (or your migration pipeline). It creates:

- `public.events` — product analytics (`tool_used`, `lead_submitted`, etc.)
- `public.leads.intent` — optional `buy` | `sell` | `refinance` for tool-sourced leads

API routes:

- `POST /api/analytics/track` — `{ eventType, metadata }`
- `POST /api/leads/tool-capture` — lead capture from `LeadCaptureModal` / tools
