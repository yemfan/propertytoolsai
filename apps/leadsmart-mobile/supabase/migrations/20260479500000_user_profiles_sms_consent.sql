-- TCPA consent audit trail on user_profiles.
--
-- The signup flow now captures an SMS consent checkbox (per the TOM
-- validation report). The FCC's rules under 47 CFR § 64.1200(f)(9)
-- define "prior express written consent" as requiring, at minimum,
-- a record of the disclosure text, signature/action of consent, date,
-- and the telephone number to which consent applies.
--
-- These columns persist that record:
--   sms_consent_accepted_at  — ISO timestamp the user ticked the box
--   sms_consent_ip           — client IP captured server-side (not reliably
--                              available client-side, so set via the
--                              /api/consent/sms endpoint)
--   sms_consent_user_agent   — browser UA at the time of consent
--   sms_consent_version      — version of the disclosure text shown. Bump
--                              this in the product code whenever the
--                              consent language materially changes so older
--                              rows can be re-consented if counsel requires.
--
-- Nullable because users without phone numbers never see the checkbox.

alter table if exists public.user_profiles
  add column if not exists sms_consent_accepted_at timestamptz null,
  add column if not exists sms_consent_ip text null,
  add column if not exists sms_consent_user_agent text null,
  add column if not exists sms_consent_version text null;

create index if not exists idx_user_profiles_sms_consent
  on public.user_profiles(user_id)
  where sms_consent_accepted_at is not null;

comment on column public.user_profiles.sms_consent_accepted_at is
  'Timestamp the user ticked the SMS consent checkbox at signup. NULL if the user has not opted in. Required for TCPA audit defense.';
comment on column public.user_profiles.sms_consent_ip is
  'IP address captured server-side when consent was recorded. Part of the TCPA audit trail.';
comment on column public.user_profiles.sms_consent_user_agent is
  'User-agent string at the time of consent.';
comment on column public.user_profiles.sms_consent_version is
  'Version marker for the disclosure text displayed. Bump in code when language changes.';
