-- Add `billing_cadence` to subscription rows for the v2.0 pricing
-- update (Pro / Premium / Signature / Team can be billed monthly OR
-- annually). Cadence isn't part of the entitlement — it only affects
-- which Stripe Price ID the row was checked out against, the renewal
-- date, and how the dashboard displays the next charge. Default
-- 'monthly' so existing rows back-fill correctly without any data
-- migration.
--
-- Constraint mirrors `BillingCadence` in `lib/billing/plans.ts`. Keep
-- the two in sync — the application reads this column through
-- `getActiveCrmSubscription` and narrows it with `isBillingCadence`.
--
-- We do NOT touch `public.agents.plan_type`: the agent row records
-- the currently active tier (used for fast gating), but cadence
-- belongs to the subscription record, not the agent identity.

alter table if exists public.subscriptions
  add column if not exists billing_cadence text not null default 'monthly';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'billing_cadence'
  ) and not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_billing_cadence_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_billing_cadence_check
      check (billing_cadence in ('monthly', 'annual'));
  end if;
end $$;

comment on column public.subscriptions.billing_cadence is
  'How this Stripe subscription is billed. Drives renewal cycle and UI display; entitlements are unaffected. Mirrors BillingCadence in lib/billing/plans.ts.';

alter table if exists public.billing_subscriptions
  add column if not exists billing_cadence text not null default 'monthly';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'billing_subscriptions'
      and column_name = 'billing_cadence'
  ) and not exists (
    select 1 from pg_constraint
    where conname = 'billing_subscriptions_billing_cadence_check'
  ) then
    alter table public.billing_subscriptions
      add constraint billing_subscriptions_billing_cadence_check
      check (billing_cadence in ('monthly', 'annual'));
  end if;
end $$;

comment on column public.billing_subscriptions.billing_cadence is
  'How this subscription is billed. Drives renewal cycle and UI display; entitlements are unaffected. Mirrors BillingCadence in lib/billing/plans.ts.';

-- Note: existing rows back-fill to 'monthly' via the default, which
-- is correct because the v1 product was monthly-only. New annual
-- checkouts (PR 2) will write 'annual' explicitly via the Stripe
-- webhook handler.
