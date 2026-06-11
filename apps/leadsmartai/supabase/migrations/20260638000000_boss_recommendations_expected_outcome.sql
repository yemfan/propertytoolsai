-- Theme constitution: every recommendation contains title, reason,
-- urgency, suggested action, and EXPECTED OUTCOME. Additive column;
-- written by lib/realtorboss/recommendations.ts, rendered in the Boss
-- dashboard Top Priorities.

alter table public.boss_recommendations
  add column if not exists expected_outcome text;

comment on column public.boss_recommendations.expected_outcome is
  'What acting on this recommendation should achieve (constitution: recommendations carry an expected outcome). Plain sentence rendered under the suggested action.';
