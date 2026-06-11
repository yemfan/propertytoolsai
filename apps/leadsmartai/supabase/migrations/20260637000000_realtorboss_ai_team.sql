-- RealtorBoss Phase 2 — AI team configuration, assistant activity
-- tracking, and Boss Assistant recommendations.
--
-- Consumers (added in the same PR):
--   • lib/realtorboss/assistants.ts      — get-or-create per-agent rows
--   • lib/realtorboss/activities.ts      — fire-and-forget activity log
--   • lib/realtorboss/recommendations.ts — deterministic priority sync
--   • /api/dashboard/realtorboss/*       — team config + boss dashboard
--
-- Writes go through the service role (API routes scope by agent_id from
-- getCurrentAgentContext); RLS select-own policies are the safety net,
-- matching the sms_messages pattern.

-- ── ai_skills — global skill catalog ─────────────────────────────
-- Keys mirror lib/ai/prompts/realtorboss/skills.ts (the runtime source
-- of prompt text); the table exists so Phase 3 can attach per-tenant
-- config without a schema change.

create table if not exists public.ai_skills (
  key text primary key,
  name text not null,
  description text not null default '',
  category text not null default 'general',
  config_schema jsonb,
  default_prompt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_skills enable row level security;

drop policy if exists "ai_skills_select_authenticated" on public.ai_skills;
create policy "ai_skills_select_authenticated" on public.ai_skills
  for select to authenticated using (true);

comment on table public.ai_skills is
  'RealtorBoss skill catalog. Prompt text source of truth lives in code (lib/ai/prompts/realtorboss/skills.ts); rows here back the AI-team configuration UI.';

-- ── ai_assistants — per-agent AI team configuration ──────────────

create table if not exists public.ai_assistants (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  type text not null check (
    type in ('boss_assistant', 'receptionist', 'sales_assistant', 'transaction_assistant')
  ),
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  description text,
  persona_prompt text,
  enabled_skills jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, type)
);

create index if not exists idx_ai_assistants_agent on public.ai_assistants(agent_id);

alter table public.ai_assistants enable row level security;

drop policy if exists "ai_assistants_select_own" on public.ai_assistants;
create policy "ai_assistants_select_own" on public.ai_assistants
  for select using (
    exists (
      select 1 from public.agents a
      where a.id = ai_assistants.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

comment on table public.ai_assistants is
  'Per-agent RealtorBoss AI team rows (boss/receptionist/sales/transaction). Seeded lazily from lib/realtorboss/team.ts on first /api/dashboard/realtorboss/team call. Pausing an assistant hides its recommendations + activity from the Boss dashboard.';

-- ── assistant_activities — what the AI team did ───────────────────

create table if not exists public.assistant_activities (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  assistant_type text not null check (
    assistant_type in ('boss_assistant', 'receptionist', 'sales_assistant', 'transaction_assistant')
  ),
  activity_type text not null,
  summary text not null,
  outcome text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  requires_attention boolean not null default false,
  related_entity_type text,
  related_entity_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_activities_agent_created
  on public.assistant_activities(agent_id, created_at desc);

alter table public.assistant_activities enable row level security;

drop policy if exists "assistant_activities_select_own" on public.assistant_activities;
create policy "assistant_activities_select_own" on public.assistant_activities
  for select using (
    exists (
      select 1 from public.agents a
      where a.id = assistant_activities.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

comment on table public.assistant_activities is
  'Activity feed rows written (fire-and-forget) by AI flows: missed-call text-backs (receptionist), SMS Auto Pilot replies (sales assistant). Rendered on the Boss dashboard + assistant pages.';

-- ── boss_recommendations — the Top Priorities engine ──────────────

create table if not exists public.boss_recommendations (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  recommendation_type text not null,
  title text not null,
  summary text,
  reason text,
  -- Sort rank: lower = more urgent (10 = overdue deadline … 40 = task hygiene).
  priority integer not null default 100,
  related_entity_type text,
  related_entity_id text,
  recommended_action text,
  action_href text,
  -- Stable identity per underlying fact (e.g. tx_deadline:<id>:<slug>),
  -- so re-syncing never resurrects a dismissed recommendation.
  dedupe_key text not null,
  status text not null default 'new' check (status in ('new', 'accepted', 'dismissed', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, dedupe_key)
);

create index if not exists idx_boss_recommendations_agent_status
  on public.boss_recommendations(agent_id, status, priority);

alter table public.boss_recommendations enable row level security;

drop policy if exists "boss_recommendations_select_own" on public.boss_recommendations;
create policy "boss_recommendations_select_own" on public.boss_recommendations
  for select using (
    exists (
      select 1 from public.agents a
      where a.id = boss_recommendations.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

comment on table public.boss_recommendations is
  'Boss Assistant Top Priorities. Synced deterministically from CRM signals (transaction deadlines, hot leads, missed calls, overdue tasks) by lib/realtorboss/recommendations.ts; agents accept/dismiss/complete via the dashboard.';

-- ── Seed the skill catalog (keys match lib/ai/prompts/realtorboss/skills.ts) ──

insert into public.ai_skills (key, name, description, category, default_prompt) values
  ('lead_capture', 'Lead Capture', 'Capture required contact info and create/update the lead record.', 'reception', 'Capture name, phone, email, source, and buyer/seller intent; create or update the lead record.'),
  ('buyer_qualification', 'Buyer Qualification', 'Determine buyer readiness and lead temperature.', 'qualification', 'Learn area, budget, property type, timeline, pre-approval status; classify hot/warm/cold.'),
  ('seller_qualification', 'Seller Qualification', 'Determine seller opportunity and lead temperature.', 'qualification', 'Learn property address, type, timeline, motivation, valuation interest; classify hot/warm/cold.'),
  ('appointment_scheduling', 'Appointment Scheduling', 'Book consultations, showings, listing appointments, or demos.', 'scheduling', 'Confirm appointment type, date/time, timezone, attendees, and location or meeting method.'),
  ('faq', 'FAQ', 'Answer approved business FAQs from the knowledge base.', 'reception', 'Answer only from the approved knowledge base; escalate and log unknown questions.'),
  ('transfer', 'Transfer / Escalation', 'Transfer or escalate urgent calls to the Realtor.', 'reception', 'Escalate on: human requested, transaction emergency, legal/contract issue, complaint, active client issue, ready-to-list seller, ready-to-offer buyer.'),
  ('speed_to_lead', 'Speed-to-Lead', 'Contact new leads immediately and attempt appointment booking.', 'conversion', 'Contact new leads as fast as possible; be helpful first, then book when interest is confirmed.'),
  ('follow_up', 'Follow-Up', 'Follow up with leads on an appropriate cadence.', 'conversion', 'Respectful cadence, vary the message, add value each time, never spammy.'),
  ('reactivation', 'Lead Reactivation', 'Warmly reconnect with old leads.', 'conversion', 'Warm check-in tone referencing the prior conversation; ask whether a move is still being considered.'),
  ('objection_handling', 'Objection Handling', 'Handle common objections calmly.', 'conversion', 'Acknowledge, add a helpful fact, offer a low-commitment next step; never pressure.'),
  ('transaction_deadlines', 'Transaction Deadline Tracking', 'Track important transaction dates and create alerts.', 'transaction', 'Track inspection/appraisal/loan/closing dates; surface 7-day items; flag overdue as high risk.'),
  ('document_reminders', 'Document Reminders', 'Remind the Realtor or client about missing documents.', 'transaction', 'Remind with property address, the missing item, and the deadline it blocks.')
on conflict (key) do nothing;
