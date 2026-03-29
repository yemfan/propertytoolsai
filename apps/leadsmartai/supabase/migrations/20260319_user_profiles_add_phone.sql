-- Add phone field for signup + agent onboarding

alter table if exists public.user_profiles
  add column if not exists phone text;

create index if not exists idx_user_profiles_phone
  on public.user_profiles(phone);

