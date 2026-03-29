-- Stripe-oriented subscription snapshot (narrow table). See also `public.billing_subscriptions`.
-- Requires `public.set_updated_at()` from 20260316000000_profiles_updated_at_trigger.sql.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);

create index if not exists idx_subscriptions_status on public.subscriptions (status);

create unique index if not exists idx_subscriptions_stripe_subscription_id
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;

create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

comment on table public.subscriptions is
  'Per-user Stripe subscription row; sync from webhooks or checkout.';
