-- ============================================================================
-- BUNDLE: all 20250319_* migrations in one run (Supabase SQL Editor or CLI).
--
-- Includes (in order):
--   1) users_ensure_user_id
--   2) create_user_profiles
--   3) agents_add_auth_user_id
--   4) tokens_and_usage
--   5) stripe_subscription_fields
--   6) leads_followups_and_engagement_all  (follow-ups + engagement + communications + log_lead_event)
--   7) smart_automation
--
-- Omitted on purpose:
--   • 20250319_reset_all_app_data.sql — DESTRUCTIVE (truncates leads, agents, etc.). Run alone if you need a dev wipe.
--   • 20250319_lead_followups.sql — superseded by #6 (older file used uuid lead_id; bundle uses bigint).
--   • 20250319_lead_engagement.sql — superseded by #6 (same reason).
--
-- Safe to re-run (IF NOT EXISTS / idempotent patterns).
-- ============================================================================

-- ========== 1) 20250319_users_ensure_user_id ==========
-- Fix: "Could not find the 'user_id' column of 'users' in the schema cache"
-- Run in Supabase → SQL Editor.

-- 1) Ensure the column exists (older DBs may have created `users` without it).
alter table public.users add column if not exists user_id uuid;

-- 2) Best-effort backfill if an older row-store used `id` instead.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'id'
  ) then
    update public.users set user_id = id where user_id is null;
  end if;
end $$;

-- 3) Ensure `upsert(..., { onConflict: 'user_id' })` works.
create unique index if not exists idx_users_user_id on public.users(user_id);

-- ========== 2) 20250319_create_user_profiles ==========
-- Create a dedicated profile table for Supabase Auth users.
-- This avoids conflicts with any existing `public.users` table that may store local-auth fields
-- like `password_hash` and other NOT NULL columns.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  full_name text,
  license_number text,
  brokerage text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_created_at on public.user_profiles(created_at desc);

-- ========== 3) 20250319_agents_add_auth_user_id ==========
-- Fix: agents.user_id is BIGINT in older schemas.
-- We store Supabase Auth UUIDs in a dedicated column instead.

alter table if exists public.agents
  add column if not exists auth_user_id uuid;

create index if not exists idx_agents_auth_user_id on public.agents(auth_user_id);
create unique index if not exists idx_agents_auth_user_id_unique
  on public.agents(auth_user_id)
  where auth_user_id is not null;

-- ========== 4) 20250319_tokens_and_usage ==========
-- Token-based usage + subscription tiers (guest/free/pro/premium)
-- Applies to `public.user_profiles` (NOT `public.users`).

alter table if exists public.user_profiles
  add column if not exists plan text not null default 'free',
  add column if not exists tokens_remaining int not null default 10,
  add column if not exists tokens_reset_date timestamptz not null default (date_trunc('month', now()) + interval '1 month');

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  tokens_used int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_logs_user_id_created_at
  on public.usage_logs(user_id, created_at desc);
create index if not exists idx_usage_logs_tool_name_created_at
  on public.usage_logs(tool_name, created_at desc);

create or replace function public.plan_default_tokens(p_plan text)
returns int
language plpgsql
as $$
begin
  if p_plan = 'pro' then
    return 100;
  elsif p_plan = 'premium' then
    return 300;
  else
    -- free (and any unknown plan) default
    return 10;
  end if;
end;
$$;

-- Atomic token consumption + monthly reset.
-- Returns: ok, tokens_remaining, plan, message
create or replace function public.consume_tokens(
  p_user_id uuid,
  p_tool_name text,
  p_tokens_required int
)
returns jsonb
language plpgsql
as $$
declare
  v_plan text;
  v_tokens int;
  v_reset timestamptz;
  v_default int;
  v_next_reset timestamptz;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Not authenticated');
  end if;

  if p_tokens_required is null or p_tokens_required < 0 then
    return jsonb_build_object('ok', false, 'message', 'Invalid token cost');
  end if;

  v_next_reset := date_trunc('month', now()) + interval '1 month';

  -- Lock the row for update to prevent negative tokens.
  select plan, tokens_remaining, tokens_reset_date
    into v_plan, v_tokens, v_reset
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if not found then
    v_plan := 'free';
    v_default := public.plan_default_tokens(v_plan);
    v_tokens := v_default;
    v_reset := v_next_reset;

    insert into public.user_profiles(user_id, plan, tokens_remaining, tokens_reset_date)
    values (p_user_id, v_plan, v_tokens, v_reset);
  end if;

  -- Monthly reset
  if v_reset is null or now() >= v_reset then
    v_default := public.plan_default_tokens(v_plan);
    v_tokens := v_default;
    v_reset := v_next_reset;

    update public.user_profiles
      set tokens_remaining = v_tokens,
          tokens_reset_date = v_reset
      where user_id = p_user_id;
  end if;

  if p_tokens_required = 0 then
    return jsonb_build_object('ok', true, 'plan', v_plan, 'tokens_remaining', v_tokens);
  end if;

  if v_tokens < p_tokens_required then
    return jsonb_build_object(
      'ok', false,
      'plan', v_plan,
      'tokens_remaining', v_tokens,
      'message', 'Upgrade required'
    );
  end if;

  -- Deduct + log
  update public.user_profiles
    set tokens_remaining = greatest(0, tokens_remaining - p_tokens_required)
  where user_id = p_user_id
  returning tokens_remaining into v_tokens;

  insert into public.usage_logs(user_id, tool_name, tokens_used)
  values (p_user_id, coalesce(nullif(p_tool_name, ''), 'unknown'), p_tokens_required);

  return jsonb_build_object('ok', true, 'plan', v_plan, 'tokens_remaining', v_tokens);
end;
$$;

-- ========== 5) 20250319_stripe_subscription_fields ==========
-- Stripe subscription sync fields on user_profiles (not legacy public.users).

alter table if exists public.user_profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

create index if not exists idx_user_profiles_stripe_customer_id
  on public.user_profiles(stripe_customer_id);
create index if not exists idx_user_profiles_stripe_subscription_id
  on public.user_profiles(stripe_subscription_id);

-- ========== 6) 20250319_leads_followups_and_engagement_all ==========
-- ALL-IN-ONE MIGRATION (DEV/PROD)
-- Smart Lead Management (follow-ups) + Lead Engagement Tracking
--
-- Includes:
-- - leads: rating/contact cadence fields + engagement fields
-- - communications table (email/sms logs)
-- - lead_events table (engagement events)
-- - log_lead_event() function (atomic scoring + debouncing)
--
-- Safe to re-run (uses IF EXISTS / IF NOT EXISTS).

-- =========================
-- LEADS: follow-up fields
-- =========================
alter table if exists public.leads
  add column if not exists rating text not null default 'warm',
  add column if not exists contact_frequency text not null default 'weekly',
  add column if not exists contact_method text not null default 'email',
  add column if not exists last_contacted_at timestamptz,
  add column if not exists next_contact_at timestamptz not null default (now() + interval '7 days');

create index if not exists idx_leads_next_contact_at on public.leads(next_contact_at);
create index if not exists idx_leads_rating on public.leads(rating);

-- =========================
-- LEADS: engagement fields
-- =========================
alter table if exists public.leads
  add column if not exists engagement_score int not null default 0,
  add column if not exists last_activity_at timestamptz;

create index if not exists idx_leads_last_activity_at on public.leads(last_activity_at desc);
create index if not exists idx_leads_engagement_score on public.leads(engagement_score desc);

-- =========================
-- COMMUNICATIONS: agent follow-ups
-- =========================
create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  -- NOTE: leads.id is BIGINT in this project, so lead_id must be BIGINT too.
  lead_id bigint not null references public.leads(id) on delete cascade,
  agent_id uuid,
  type text not null, -- email | sms
  content text not null,
  status text not null, -- sent | failed
  created_at timestamptz not null default now()
);

create index if not exists idx_communications_lead_id_created_at
  on public.communications(lead_id, created_at desc);
create index if not exists idx_communications_agent_id_created_at
  on public.communications(agent_id, created_at desc);

-- =========================
-- LEAD EVENTS: engagement tracking
-- =========================
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  -- NOTE: leads.id is BIGINT in this project, so lead_id must be BIGINT too.
  lead_id bigint not null references public.leads(id) on delete cascade,
  agent_id uuid,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_events_lead_id_created_at
  on public.lead_events(lead_id, created_at desc);
create index if not exists idx_lead_events_agent_id_created_at
  on public.lead_events(agent_id, created_at desc);
create index if not exists idx_lead_events_event_type_created_at
  on public.lead_events(event_type, created_at desc);

-- =========================
-- Atomic scoring + debouncing
-- =========================
create or replace function public.log_lead_event(
  p_lead_id bigint,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_agent_id uuid;
  v_score_delta int := 0;
  v_window interval := interval '0 minutes';
  v_now timestamptz := now();
  v_last_event timestamptz;
  v_new_score int;
begin
  if p_lead_id is null or coalesce(nullif(trim(p_event_type), ''), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Invalid input');
  end if;

  -- Score mapping
  if p_event_type = 'email_open' then
    v_score_delta := 5;
    v_window := interval '10 minutes';
  elsif p_event_type = 'link_click' then
    v_score_delta := 10;
    v_window := interval '1 minute';
  elsif p_event_type = 'report_view' then
    v_score_delta := 20;
    v_window := interval '5 minutes';
  else
    v_score_delta := 0;
    v_window := interval '1 minute';
  end if;

  -- Lock lead row and derive agent_id
  select agent_id into v_agent_id
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Lead not found');
  end if;

  -- Debounce: if same event type happened recently, skip scoring + insert
  select max(created_at) into v_last_event
  from public.lead_events
  where lead_id = p_lead_id
    and event_type = p_event_type
    and created_at >= (v_now - v_window);

  if v_last_event is not null then
    update public.leads
      set last_activity_at = v_now
    where id = p_lead_id
    returning engagement_score into v_new_score;

    return jsonb_build_object('ok', true, 'debounced', true, 'engagement_score', v_new_score);
  end if;

  insert into public.lead_events(lead_id, agent_id, event_type, metadata)
  values (p_lead_id, v_agent_id, p_event_type, coalesce(p_metadata, '{}'::jsonb));

  update public.leads
    set engagement_score = greatest(0, engagement_score + v_score_delta),
        last_activity_at = v_now
  where id = p_lead_id
  returning engagement_score into v_new_score;

  return jsonb_build_object(
    'ok', true,
    'debounced', false,
    'score_delta', v_score_delta,
    'engagement_score', v_new_score
  );
end;
$$;

-- ========== 7) 20250319_smart_automation ==========
-- AI-powered Smart Follow-Up automation (rules + logs)

-- Per-lead opt-out
alter table if exists public.leads
  add column if not exists automation_disabled boolean not null default false;

-- Rules
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null, -- report_view | high_engagement | inactivity
  condition jsonb not null default '{}'::jsonb,
  message_template text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_rules_active on public.automation_rules(active);
create index if not exists idx_automation_rules_trigger_type on public.automation_rules(trigger_type);

-- Logs
create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  message text not null,
  status text not null, -- sent | failed | skipped
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_logs_lead_id_created_at
  on public.automation_logs(lead_id, created_at desc);
create index if not exists idx_automation_logs_rule_id_created_at
  on public.automation_logs(rule_id, created_at desc);

-- Seed default rules (safe to re-run)
do $$
begin
  if not exists (select 1 from public.automation_rules where name = 'Report viewed follow-up') then
    insert into public.automation_rules(name, trigger_type, condition, message_template, active)
    values (
      'Report viewed follow-up',
      'report_view',
      jsonb_build_object('within_hours', 24),
      'Hi {{name}}, thanks for checking out your property report for {{address}}. Want me to run a quick CMA update and share the best next steps?',
      true
    );
  end if;

  if not exists (select 1 from public.automation_rules where name = 'High engagement follow-up') then
    insert into public.automation_rules(name, trigger_type, condition, message_template, active)
    values (
      'High engagement follow-up',
      'high_engagement',
      jsonb_build_object('min_score', 70),
      'Hi {{name}} — I noticed you’ve been actively reviewing your report for {{address}}. Are you open to a quick call to talk timing and pricing strategy?',
      true
    );
  end if;

  if not exists (select 1 from public.automation_rules where name = 'Inactivity re-engagement') then
    insert into public.automation_rules(name, trigger_type, condition, message_template, active)
    values (
      'Inactivity re-engagement',
      'inactivity',
      jsonb_build_object('inactive_days', 7),
      'Hi {{name}}, just checking in. If you’d like an updated snapshot for {{address}} or have any questions, I’m here to help. Should I check back next week?',
      true
    );
  end if;
end $$;

-- ============================================================================
-- End of bundle.
-- ============================================================================
