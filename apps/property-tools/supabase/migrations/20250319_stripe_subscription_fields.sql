-- Stripe subscription sync fields on user_profiles (not legacy public.users).

alter table if exists public.user_profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

create index if not exists idx_user_profiles_stripe_customer_id
  on public.user_profiles(stripe_customer_id);
create index if not exists idx_user_profiles_stripe_subscription_id
  on public.user_profiles(stripe_subscription_id);
