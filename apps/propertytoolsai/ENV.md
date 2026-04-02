# Environment variables (PropertyTools app)

## Where is `.env.local`?

Next.js loads env files from **this app folder**, not the monorepo root:

`apps/propertytoolsai/.env.local`

There is **no** `.env.local` at `Propertytoolsai/` (repo root) for this app.

## Why you might not “see” it

1. **Gitignore** — `.env*.local` is listed in `.gitignore`, so the file is not committed. A fresh clone has no `.env.local` until you create it.
2. **IDE** — Some views hide gitignored files. In VS Code / Cursor: check **Explorer** settings for excluding gitignored files, or open the file directly (**File → Open File**) and paste:
   `apps/propertytoolsai/.env.local`
3. **Windows Explorer** — Dotfiles are easy to miss; use “Show hidden files” if needed.

## Create it

From `apps/propertytoolsai`:

```bash
copy .env.example .env.local
```

(PowerShell: `Copy-Item .env.example .env.local`)

Then fill in real values. For address autocomplete, set **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** (Places API + billing on that Google Cloud project).

**Duplicate keys:** If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` appears more than once, the **last** line wins. An empty second line will clear the key and break address suggestions.

## Google Places / address autocomplete “worked before, not now”

The Home Value (and other) address fields use **Google Places** in the browser. Nothing in-repo proves your key is valid until the browser calls Google. Typical causes when it **stops** working:

1. **Wrong app `.env.local`** — Next only loads `apps/propertytoolsai/.env.local` for the **propertytoolsai** app. A key only in `apps/leadsmartai/.env.local` does **not** apply when you run propertytoolsai. Each app needs its own file (or copy the line over).
2. **Port / referrer mismatch** — API keys restricted to **HTTP referrers** must list the exact dev URL you use, including port:
   - `http://localhost:3000/*` **and** `http://localhost:3001/*` (and `127.0.0.1` variants if you use them).
   - Root `npm run dev` (Turbo) may start **multiple** apps; Next picks the next free port (3000, 3001, 3002…). If your Google key only allows `3001` but the app is on `3002`, Places returns **REQUEST_DENIED** (red message under the field).
3. **Restart dev after changing env** — `NEXT_PUBLIC_*` is inlined at dev server start. Change `.env.local` → stop `npm run dev` → start again.
4. **Billing / APIs** — Google Cloud: **Maps JavaScript API** + **Places API** enabled, billing active, quotas not exceeded.

**Quick check:** Under the address field you should see either suggestions, a gray hint (no matches), an amber “add API key” line, or a red error. Open DevTools → **Console** for `[AddressAutocomplete] getPlacePredictions status:` in development.

## Stripe checkout (“No such price: prod_…”)

`STRIPE_PRICE_ID_PRO` (Consumer Basic) and **`STRIPE_PRICE_ID_CONSUMER_PREMIUM`** (Consumer Premium, e.g. $19/mo) must be **Price** IDs (`price_…`), not **Product** IDs (`prod_…`). If `STRIPE_PRICE_ID_CONSUMER_PREMIUM` is unset, checkout falls back to `STRIPE_PRICE_ID_PREMIUM`.

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Product catalog** → open your product.
2. Under **Pricing**, copy the id next to the recurring price — it looks like `price_xxxxxxxx`.
3. Put that value in `apps/propertytoolsai/.env.local` and restart `npm run dev`.

If you paste a Product id (`prod_…`), Stripe returns: `No such price: 'prod_…'`.

## Product analytics & lead capture

Apply the migration in `supabase/migrations/20260315_product_events_and_lead_intent.sql` in the Supabase SQL editor (or your migration pipeline). It creates:

- `public.events` — product analytics (`tool_used`, `lead_submitted`, etc.)
- `public.leads.intent` — optional `buy` | `sell` | `refinance` for tool-sourced leads

API routes:

- `POST /api/analytics/track` — `{ eventType, metadata }`
- `POST /api/leads/tool-capture` — lead capture from `LeadCaptureModal` / tools
