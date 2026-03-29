-- Idempotent upgrade if an older `billing_subscriptions` migration was applied first.

alter table if exists public.billing_subscriptions
  alter column user_id drop not null;

alter table if exists public.billing_subscriptions
  add column if not exists provider_price_id text;

alter table if exists public.billing_subscriptions
  alter column role set default 'consumer';

create unique index if not exists idx_billing_provider_subscription
  on public.billing_subscriptions(provider_subscription_id);

create index if not exists idx_billing_provider_customer
  on public.billing_subscriptions(provider_customer_id);
