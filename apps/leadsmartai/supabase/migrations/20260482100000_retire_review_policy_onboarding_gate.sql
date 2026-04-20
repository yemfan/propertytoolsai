-- Retire the §2.4 30-day draft-only window on agent_message_settings.
--
-- The original gate forced effective_review_policy = 'review' for agents
-- in their first 30 days, regardless of what they saved. Product decision
-- reversed that: the 30-day coercion is now a UI recommendation only, and
-- the effective policy should match the stored policy unconditionally.
-- App layer removed the backend throw in lib/agent-messaging/settings.ts
-- and the UI lock in components/dashboard/ReviewPolicyPanel.tsx.
--
-- `onboarding_gate_active` still computed so existing UI code that reads
-- it keeps compiling — but it's now informational (drives a "Recommended"
-- badge on "Review each one", nothing more).

create or replace view public.agent_message_settings_effective as
select
  s.id,
  s.agent_id,
  s.review_policy as effective_review_policy,
  s.review_policy_by_category as effective_review_policy_by_category,
  s.review_policy as stored_review_policy,
  s.review_policy_by_category as stored_review_policy_by_category,
  -- Informational flag for the UI ("Recommended for your first 30 days").
  -- No longer used to override effective_* values.
  (a.created_at > (now() - interval '30 days')) as onboarding_gate_active,
  s.quiet_hours_start,
  s.quiet_hours_end,
  s.use_contact_timezone,
  s.no_sunday_morning,
  s.pause_chinese_new_year,
  s.max_per_contact_per_day,
  s.pause_on_reply_days,
  a.created_at as agent_created_at,
  s.updated_at
from public.agent_message_settings s
join public.agents a on a.id = s.agent_id;

comment on view public.agent_message_settings_effective is
  'Effective messaging policy. The 30-day onboarding gate was retired — effective_* columns now mirror stored_* unconditionally. onboarding_gate_active remains as an informational flag for UI recommendations.';

comment on column public.agent_message_settings.review_policy is
  'Agent-selected messaging policy (review / autosend / per_category). Applies from day one — no mandatory draft-only window.';
