-- Same as leadsmartai: shared Supabase project — OAuth onboarding flag on user_profiles.

alter table public.user_profiles
  add column if not exists oauth_onboarding_completed boolean not null default false;

comment on column public.user_profiles.oauth_onboarding_completed is
  'True after the user finishes OAuth onboarding (name, role, phone). Email/password signups set this true when they submit the signup form.';

update public.user_profiles
set oauth_onboarding_completed = true
where oauth_onboarding_completed = false;
