-- Canonical billing rows; optional link to `public.profiles` (see 20260315000000_create_profiles_table.sql).
-- Requires `public.set_updated_at()` from 20260316000000_profiles_updated_at_trigger.sql.

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete cascade,
  email text not null,
  full_name text null,
  role text not null default 'consumer',

  plan text not null,
  status text not null default 'active',
  amount_monthly numeric not null default 0,

  billing_provider text not null default 'stripe',
  provider_customer_id text null,
  provider_subscription_id text null,
  provider_price_id text null,

  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_subscriptions_user_id
  on public.billing_subscriptions(user_id);

create index if not exists idx_billing_subscriptions_status
  on public.billing_subscriptions(status);

create index if not exists idx_billing_subscriptions_role
  on public.billing_subscriptions(role);

create unique index if not exists idx_billing_provider_subscription
  on public.billing_subscriptions(provider_subscription_id);

create index if not exists idx_billing_provider_customer
  on public.billing_subscriptions(provider_customer_id);

drop trigger if exists trg_billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger trg_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row
execute function public.set_updated_at();

comment on table public.billing_subscriptions is 'Subscription billing snapshot; optional profile link; sync from Stripe or admin tools.';
