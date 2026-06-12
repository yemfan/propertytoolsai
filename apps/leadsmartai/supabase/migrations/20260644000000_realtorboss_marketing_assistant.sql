-- RealtorBoss — Marketing Assistant (6th AI team member).
--
-- Takes over demand generation from the Sales Assistant: social
-- posts, marketing plans, templates, sphere nurture, lead-gen
-- campaigns. The Sales Assistant keeps lead CONVERSION (speed-to-
-- lead, follow-up, queue, drafts).
--
-- Pattern mirrors 20260641 (accountant): widen the type CHECKs and
-- seed the marketing skills; per-agent ai_assistants rows seed lazily
-- from the roster on the next team fetch (no backfill needed).

alter table public.ai_assistants
  drop constraint if exists ai_assistants_type_check;
alter table public.ai_assistants
  add constraint ai_assistants_type_check check (
    type in (
      'boss_assistant', 'receptionist', 'sales_assistant',
      'marketing_assistant', 'transaction_assistant', 'accountant'
    )
  );

alter table public.assistant_activities
  drop constraint if exists assistant_activities_assistant_type_check;
alter table public.assistant_activities
  add constraint assistant_activities_assistant_type_check check (
    assistant_type in (
      'boss_assistant', 'receptionist', 'sales_assistant',
      'marketing_assistant', 'transaction_assistant', 'accountant'
    )
  );

-- Marketing skill catalog rows (prompt text source of truth lives in
-- the pack: industry-packs/real-estate/src/realtorboss/skills.ts).
insert into public.ai_skills (key, name, description, category, default_prompt) values
  ('social_content', 'Social Content',
   'Create and schedule social posts that keep the Realtor visible.', 'marketing',
   'Create social posts (listings, market updates, open houses, wins) and keep a steady publishing schedule. Match the Realtor''s voice, keep captions short and human, and never invent listing facts — use only what is in the CRM.'),
  ('marketing_plans', 'Marketing Plans',
   'Build and run multi-step SMS/email marketing plans.', 'marketing',
   'Build and run multi-step marketing plans (SMS and email sequences). Every step must add value — market info, new listings, helpful answers. Watch plans for stalls and surface ones that stop producing engagement.'),
  ('sphere_nurture', 'Sphere Nurture',
   'Keep the Realtor''s sphere warm with drips and digests.', 'marketing',
   'Keep the sphere warm: drip campaigns, buyer/seller digests, and occasion touches. The goal is staying top of mind, never selling hard — a Realtor''s repeat and referral business lives here.'),
  ('lead_generation', 'Lead Generation',
   'Run campaigns and tools that bring in new leads.', 'marketing',
   'Run the surfaces that create new leads: ad campaigns, quick posts, the home-valuation tool, and shareable links. Track which sources actually produce contacts and recommend doubling down on what works.')
on conflict (key) do nothing;
