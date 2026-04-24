-- AI action metering for agent plans.
--
-- Context: Starter users currently have free rein on every AI-bearing
-- endpoint (CMA generation / deal review / growth opps / etc.), which
-- means a single Starter agent can burn more Claude tokens in a week
-- than a Pro customer's LTV. This migration introduces a per-plan
-- monthly AI-action quota the same way CMA reports are already
-- per-day limited.
--
-- "AI action" is a single logical call: one CMA, one deal review, one
-- growth-ops refresh, etc. The cost per call varies in tokens but is
-- flat in our UX ("1 AI action"). Plan caps:
--   Starter: 10 / month
--   Growth:  500 / month
--   Elite:   NULL = unlimited
--
-- This migration:
--   1) adds ai_actions_per_month to product_entitlements (plan cap)
--   2) adds ai_actions_used to entitlement_usage_daily (daily bucket)
--   3) creates a helper view that rolls up monthly usage per (user,
--      product) so the check-limit helper can query it in one read.

alter table public.product_entitlements
  add column if not exists ai_actions_per_month integer;

comment on column public.product_entitlements.ai_actions_per_month is
  'Per-plan monthly cap on AI-bearing actions (CMA / deal review / growth / AI SMS). NULL = unlimited.';

alter table public.entitlement_usage_daily
  add column if not exists ai_actions_used integer not null default 0;

comment on column public.entitlement_usage_daily.ai_actions_used is
  'Count of AI actions charged on this UTC date bucket. Rolled up into a monthly view for quota checks.';

-- Rolling monthly AI usage per (user, product). Month = UTC calendar
-- month of usage_date. A materialized view would be overkill — the
-- underlying daily table is tiny per user, so a plain view is fine.
create or replace view public.entitlement_ai_usage_monthly as
select
  user_id,
  product,
  date_trunc('month', usage_date)::date as month_start,
  sum(ai_actions_used)::integer as ai_actions_used
from public.entitlement_usage_daily
group by user_id, product, date_trunc('month', usage_date);

comment on view public.entitlement_ai_usage_monthly is
  'Rolling monthly AI-action counters, aggregated from daily buckets. Used by canUseAiAction.';

-- Backfill the cap onto existing entitlement rows. We default Starter
-- to 10 so recently-activated free users don't get a surprise zero,
-- and existing Growth/Elite stay unlimited pending the next sync via
-- planRowFromCatalog.
update public.product_entitlements
set ai_actions_per_month = 10
where plan = 'starter'
  and ai_actions_per_month is null;

update public.product_entitlements
set ai_actions_per_month = 500
where plan = 'growth'
  and ai_actions_per_month is null;
-- Elite stays NULL (unlimited).
