-- First-touch app for shared auth users: drives consumer post-login routing (LeadSmart vs PropertyTools).
alter table if exists public.user_profiles
  add column if not exists signup_origin_app text;

comment on column public.user_profiles.signup_origin_app is
  'Where the account first registered: leadsmart | propertytools | mobile. Null = legacy; consumers use LeadSmart unless propertytools.';

alter table public.user_profiles drop constraint if exists user_profiles_signup_origin_app_check;

alter table public.user_profiles
  add constraint user_profiles_signup_origin_app_check
  check (signup_origin_app is null or signup_origin_app in ('leadsmart', 'propertytools', 'mobile'));
