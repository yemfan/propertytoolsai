# Founder analytics (LeadSmart)

Production-oriented SaaS metrics for admins: **billing truth in Postgres**, **append-only events** for history, and **funnel tables** for activation and conversion.

## Schema

| Table | Purpose |
|--------|---------|
| `public.usage_events` | Product usage (`event_type`, `metadata`, optional `user_id`). |
| `public.subscription_events` | Billing lifecycle (`event_type`, `plan`, `amount`, `stripe_subscription_id`, `metadata`). |
| `public.billing_subscriptions` | **Canonical current MRR** (`amount_monthly`, `status`). |
| `public.leadsmart_funnel_state` | Milestones (`onboarding_completed_at`, `first_reply_at`, `first_ai_usage_at`). |
| `public.leadsmart_funnel_events` | Funnel stream (`upgrade_checkout_started`, `subscription_active_crm`, …). |

Apply migrations (including `20260469000000_subscription_events_stripe_ref.sql` for `stripe_subscription_id` + `metadata` on `subscription_events`).

## Tracking (what writes where)

- **Usage** — `recordUsageEvent` in `lib/analytics/analyticsEvents.ts`  
  - Wired: successful AI credit consumption → `ai_draft_consumed` with `surface` metadata (`deal_assistant`, `mobile_email_ai_reply`, `mobile_sms_ai_reply`) via `tryConsumeAiCredit` in `lib/funnel/aiUsage.ts`.
- **Subscriptions** — `recordSubscriptionEvent`  
  - **Stripe sync** (`syncStripeSubscription`): on material change, emits `billing_updated` (paying), `billing_inactive` (non-paying), or `subscription_canceled` when a previously paying row becomes `canceled`.  
  - **Stripe delete** (`markSubscriptionCanceled`): emits `subscription_canceled`.  
  - **CRM mirror** (`syncPublicSubscriptionFromStripe`): on plan/status change while active/trialing, emits `crm_subscription_active` (throttled vs prior `subscriptions` row).

Canonical **event type** names live in `lib/analytics/eventCatalog.ts`.

## API (admin-only, session RBAC)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/api/admin/metrics/overview?days=30&churnDays=30` | `admin` |
| `GET` | `/api/admin/metrics/revenue?weeks=12&seriesDays=400` | `admin` |
| `GET` | `/api/admin/metrics/funnel?days=30` | `admin` |
| `GET` | `/api/admin/metrics/usage?days=30` | `admin` |

All routes use `requireRoleRoute(["admin"], { strictUnauthorized: true })`.

## Metric definitions

- **MRR** — Sum of `billing_subscriptions.amount_monthly` where `status` ∈ (`active`, `trialing`). This is the **source of truth** for headline MRR.
- **MAU (usage)** — Distinct `usage_events.user_id` in the last `days` window (null `user_id` excluded).
- **Activation rate** — Among rows with `onboarding_completed_at` set, share where `first_reply_at` is within **7 days** after onboarding completion.
- **Checkout conversion** — In the window, distinct users with `subscription_active_crm` who also have `upgrade_checkout_started`, divided by distinct checkout starters in the window.
- **Churn rate (approx.)** — Distinct users with `subscription_canceled` in the churn window ÷ `max(1, paying_users_now + churned_distinct_in_window)`. Documented in API as an approximation when subscriber mix shifts quickly; at scale prefer cohort snapshots or **dunning-aware** churn.
- **Weekly MRR from events** — Replay of `subscription_events` with `stripe_subscription_id` (types: `billing_updated`, `billing_inactive`, `subscription_canceled`). Converges toward billing truth as webhooks accumulate; capped at 10k rows per request for safety.

## UI

- **Route:** `/admin/founder` (React + Tailwind + Recharts).  
- Nav: **Founder analytics** (admin role).

## Scaling notes

- Move heavy rollups to **scheduled SQL** (daily MRR snapshot table) when event volume grows.  
- Add **RLS** or a dedicated **read replica** for analytics if admins query large windows.  
- Keep **Stripe webhooks** idempotent; subscription event volume scales with plan changes, not reads.
