# LeadSmart AI Stripe billing (CRM subscriptions)

End-to-end **monthly subscriptions** for CRM tiers **starter**, **pro**, and **team**, with **Stripe Checkout**, **Customer Portal**, **webhooks**, `public.subscriptions` storage, and **feature gating**.

## Schema

- **`public.subscriptions`** — one row per Stripe subscription (upserted on `stripe_subscription_id`).  
  Migration: `supabase/migrations/20260465100000_subscriptions.sql`  
- **`public.billing_subscriptions`** — existing analytics/admin snapshot (unchanged; still updated by `syncStripeSubscription`).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Server Stripe client |
| `STRIPE_WEBHOOK_SECRET` | Verify `POST /api/stripe/webhook` |
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs for Checkout / portal return (production) |
| `STRIPE_PRICE_ID_CRM_STARTER` | Recurring **monthly** price ID (`price_…`) for Starter |
| `STRIPE_PRICE_ID_CRM_PRO` | Pro |
| `STRIPE_PRICE_ID_CRM_TEAM` | Team |

Legacy agent prices (`STRIPE_PRICE_ID_AGENT_*`, etc.) still map to `InternalPlan` and sync entitlements. Those rows also populate `public.subscriptions` via **`agent_starter` → pro tier** and **`agent_pro` → team tier** for feature checks (see `mapInternalPlanToCrmSlug`).

## Plan catalog & features

Source of truth: `lib/billing/plans.ts` — `PLANS`, `hasFeature`, `PlanFeature`.

| Tier | Feature flags (high level) |
|------|----------------------------|
| Starter | `basic_crm`, `limited_ai` |
| Pro | `full_ai`, `automation`, `prediction` |
| Team | `multi_agent`, `routing` |

## API routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/billing/crm-checkout` | JSON `{ "plan": "starter" \| "pro" \| "team" }` → `{ url }` (hosted Checkout). |
| `POST` | `/api/billing/portal` | JSON `{ url }` to Stripe Customer Portal (manage card, cancel). |
| `GET` | `/api/billing/subscription` | Current user’s active CRM subscription + `catalog` (prices/features). |
| `POST` | `/api/stripe/webhook` | Existing handler — signs events, calls `syncStripeSubscription` + profile sync. |

Aliases: `POST /api/stripe/checkout` and `POST /api/billing/create-checkout-session` remain for other products.

## Webhook reliability

- Handler returns **500** on failure so Stripe **retries** (`checkout.session.completed`, `customer.subscription.*`, `invoice.*`).
- Upserts are **idempotent** (`billing_subscriptions` on `provider_subscription_id`, `subscriptions` on `stripe_subscription_id`).
- Checkout success page (`/checkout-success?session_id=…&product=crm`) runs the same sync path immediately to avoid UI races.

Configure the webhook in Stripe for your deployed URL: `https://<host>/api/stripe/webhook`.

## Feature gating

Helpers: `lib/billing/subscriptionAccess.ts`

- `getActiveCrmSubscription(userId)` — `active` / `trialing` row in `public.subscriptions`.
- `userHasCrmFeature(userId, feature)`
- `subscriptionRequiredResponse(feature)` — **402** JSON for APIs.

**Gated today**

- **Deal prediction** (`prediction`): dashboard deal-prediction list + per-lead recompute.
- **Deal assistant** (`full_ai`): `POST /api/deal-assistant/analyze` (also requires auth).
- **Mobile AI drafts** (`limited_ai`): SMS + email `ai-reply` mobile routes.
- **Smart automation cron** (`automation`): `GET /api/cron/smart-automation` skips agents without the flag.

Extend the same pattern for new routes (e.g. team routing) by checking `multi_agent` / `routing`.

## Web UI

- **`/dashboard/billing`** — plans, subscribe buttons, portal, copy-paste URL for mobile.
- Settings sidebar **Billing** link points here.

## Mobile (external checkout)

- Do **not** use in-app purchase; open **`billingPageUrl`** from `GET /api/billing/subscription` or hardcode `NEXT_PUBLIC_SITE_URL + /dashboard/billing` so users complete **Stripe Checkout** in the system browser.
- After payment, webhooks + optional redirect to `/checkout-success?...&product=crm` keep `public.subscriptions` in sync; the app can re-fetch `GET /api/billing/subscription`.

## Internal plan metadata

Checkout sets `subscription.metadata.internal_plan` to `crm_starter` | `crm_pro` | `crm_team`.  
`resolveInternalPlanFromStripeSubscription` accepts these values even before price IDs are wired in every env.

`resolvePaidPlanFromStripe` maps CRM metadata onto legacy **`agents` / `user_profiles`** buckets: starter → `pro`, pro/team → `premium`, so existing token/plan plumbing keeps working alongside the new CRM table.
