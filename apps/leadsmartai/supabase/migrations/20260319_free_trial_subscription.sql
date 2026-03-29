-- Free trial fields for plan gating

alter table if exists public.user_profiles
  add column if not exists trial_used boolean not null default false,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

create index if not exists idx_user_profiles_trial_ends_at
  on public.user_profiles(trial_ends_at);

