-- Optional columns for admin billing UI + future Stripe period sync.
alter table if exists public.user_profiles
  add column if not exists subscription_current_period_start timestamptz,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

comment on column public.user_profiles.subscription_current_period_start is 'Stripe current period start (admin billing / analytics).';
comment on column public.user_profiles.subscription_current_period_end is 'Stripe current period end (admin billing / analytics).';
comment on column public.user_profiles.subscription_cancel_at_period_end is 'True if subscription cancels at period end.';
