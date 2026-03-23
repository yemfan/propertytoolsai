# Revenue Dashboard + KPI System

Full-stack analytics for **revenue**, **funnel conversion**, **threshold alerts**, and **AI insights** (OpenAI).

## Database (Supabase)

Run migrations (in order):

1. `supabase/migrations/20260415_revenue_kpi_system.sql` — creates tables with **`agent_id` matching `public.agents.id`** (uuid **or** bigint).
2. `supabase/migrations/20260416_revenue_kpi_agent_id_repair.sql` — if an older run used `uuid` for `agent_id` while your `agents.id` is **bigint**, this drops and recreates the four tables (clears any test data in those tables).

If you see `operator does not exist: bigint = uuid`, apply **`20260416`** (or run its SQL in the Supabase SQL editor).

Tables:

| Table | Purpose |
|--------|---------|
| `agent_business_events` | Funnel / product events (`funnel_page_view`, `funnel_tool_open`, …) |
| `revenue_transactions` | Revenue rows (Stripe + manual); `external_ref` for idempotency |
| `kpi_alert_rules` | Metric + operator + threshold + cooldown |
| `kpi_alert_events` | Alert history |

RLS: authenticated agents can **read** their own rows; **writes** go through Next.js API routes (service role).

**Realtime (optional):** In Supabase → Database → Replication, add `revenue_transactions` and `kpi_alert_events` to the `supabase_realtime` publication so the dashboard updates instantly on inserts.

## API

| Method | Path | Description |
|--------|------|-------------|
> **Note:** The PropertyToolsAI web app no longer ships a `/dashboard` UI; revenue API routes below were removed with that surface. This doc is kept for reference if you reintroduce an admin console.

| `GET` | `/api/dashboard/revenue/summary?days=30` | KPIs, daily series, funnel, rules, alert feed |
| `POST` | `/api/revenue/track` | Track event (auth required); body: `eventName`, `sessionId`, `properties` |
| `POST` | `/api/dashboard/revenue/evaluate-alerts` | Run threshold checks (`{ days }`) |
| `PATCH` | `/api/dashboard/revenue/rules` | Toggle rule: `{ ruleId, enabled }` |
| `POST` | `/api/dashboard/revenue/insights` | AI narrative (`OPENAI_API_KEY`) |

## Funnel event names (default)

Defined in `lib/revenueKpi/types.ts` as `DEFAULT_FUNNEL_STEPS`:

1. `funnel_page_view`
2. `funnel_tool_open`
3. `funnel_lead_submit`
4. `funnel_booking`
5. `funnel_purchase`

Track these from your app via `POST /api/revenue/track` (logged-in agent session).

## Stripe

`invoice.paid` webhooks call `recordStripeInvoiceRevenue` → inserts into `revenue_transactions` with `external_ref = stripe_invoice_<id>`.

Requires `user_id` in subscription/invoice metadata to resolve `agents.auth_user_id`.

## Access control

The **Revenue** nav item and **`/dashboard/revenue`** are shown only when **`user_profiles.role`** is **`admin`** (case-insensitive). Non-admins are redirected to **`/dashboard/overview`**. Revenue API routes under **`/api/dashboard/revenue/*`** return **403** for non-admins.

Event tracking via **`POST /api/revenue/track`** stays available to any authenticated agent so funnel data can still be recorded from tools.

## Dashboard

**`/dashboard/revenue`** — KPI cards, revenue chart, funnel bars, alerts, rule toggles, AI insights, 30s polling, optional Realtime (admins only).

## Smoke test

```bash
cd apps/property-tools
npm run smoke:revenue-kpi
```

## Environment

- `OPENAI_API_KEY` — optional, for AI insights (`OPENAI_INSIGHTS_MODEL` defaults to `gpt-4o-mini`).
