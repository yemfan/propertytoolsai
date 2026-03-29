-- ============================================================================
-- BUNDLE: all 20260319_* migrations in one run (Supabase SQL Editor or CLI).
--
-- Includes (in order):
--   1) user_profiles_add_phone
--   2) leads_progressive_capture
--   3) free_trial_subscription
--   4) usage_limits (+ increment_usage)
--   5) cma_daily_usage
--   6) tasks_schema_compat (creates public.tasks with agent_id type = agents.id)
--   7) performance_dashboard (indexes)
--   8) daily_briefings
--   9) dashboard_drilldown (indexes)
--
-- Omitted (redundant with #6):
--   • 20260319_tasks.sql — same table as schema_compat; agent_id uuid only.
--   • 20260319_tasks_ensure_exists.sql — same; use schema_compat instead.
--
-- Prerequisites (run 20250319_bundle_all.sql or equivalent first):
--   • public.agents, public.leads, public.user_profiles with Stripe/subscription columns
--   • communications, lead_events, automation_logs (from 20250319 leads/engagement bundle)
--
-- daily_briefings: agent_id type matches public.agents.id (uuid or bigint).
--
-- Safe to re-run (IF NOT EXISTS / idempotent patterns).
-- ============================================================================

-- ========== 1) 20260319_user_profiles_add_phone ==========
-- Add phone field for signup + agent onboarding

alter table if exists public.user_profiles
  add column if not exists phone text;

create index if not exists idx_user_profiles_phone
  on public.user_profiles(phone);

-- ========== 2) 20260319_leads_progressive_capture ==========
-- Progressive Lead Capture fields

alter table if exists public.leads
  add column if not exists stage text,
  add column if not exists source text,
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists phone text;

create index if not exists idx_leads_stage on public.leads(stage);
create index if not exists idx_leads_email on public.leads(email);

-- ========== 3) 20260319_free_trial_subscription ==========
-- Free trial fields for plan gating

alter table if exists public.user_profiles
  add column if not exists trial_used boolean not null default false,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

create index if not exists idx_user_profiles_trial_ends_at
  on public.user_profiles(trial_ends_at);

-- ========== 4) 20260319_usage_limits ==========
-- Usage counters + paywall limits

alter table if exists public.user_profiles
  add column if not exists estimator_usage_count int not null default 0,
  add column if not exists cma_usage_count int not null default 0,
  add column if not exists usage_reset_date timestamptz;

create index if not exists idx_user_profiles_usage_reset_date
  on public.user_profiles(usage_reset_date);

-- Atomic increment + limit enforcement for free users.
-- Returns JSON: { ok: bool, tool: text, used: int, limit: int|null, reset_at: timestamptz|null }
create or replace function public.increment_usage(p_user_id uuid, p_tool text)
returns jsonb
language plpgsql
as $$
declare
  v_plan text;
  v_status text;
  v_used int := 0;
  v_limit int;
  v_now timestamptz := now();
  v_reset timestamptz;
  v_current_reset timestamptz;
begin
  if p_user_id is null or coalesce(nullif(trim(p_tool), ''), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Invalid input');
  end if;

  -- Monthly reset at first of next month (UTC)
  v_reset := date_trunc('month', v_now) + interval '1 month';

  select plan, subscription_status, usage_reset_date
    into v_plan, v_status, v_current_reset
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Profile not found');
  end if;

  -- Reset if needed
  if v_current_reset is null or v_current_reset <= v_now then
    update public.user_profiles
      set estimator_usage_count = 0,
          cma_usage_count = 0,
          usage_reset_date = v_reset
    where user_id = p_user_id;
  end if;

  -- If subscribed (active or trialing), don't enforce limits; still track.
  if lower(coalesce(v_status,'')) in ('active','trialing') then
    if p_tool = 'estimator' then
      update public.user_profiles
        set estimator_usage_count = estimator_usage_count + 1
      where user_id = p_user_id
      returning estimator_usage_count into v_used;
      return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', null, 'reset_at', v_reset);
    elsif p_tool = 'cma' then
      update public.user_profiles
        set cma_usage_count = cma_usage_count + 1
      where user_id = p_user_id
      returning cma_usage_count into v_used;
      return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', null, 'reset_at', v_reset);
    else
      return jsonb_build_object('ok', false, 'message', 'Unknown tool');
    end if;
  end if;

  -- Free limits
  if p_tool = 'estimator' then
    v_limit := 3;
    select estimator_usage_count into v_used from public.user_profiles where user_id = p_user_id;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset, 'status', 402);
    end if;
    update public.user_profiles
      set estimator_usage_count = estimator_usage_count + 1
    where user_id = p_user_id
    returning estimator_usage_count into v_used;
    return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset);
  elsif p_tool = 'cma' then
    v_limit := 1;
    select cma_usage_count into v_used from public.user_profiles where user_id = p_user_id;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset, 'status', 402);
    end if;
    update public.user_profiles
      set cma_usage_count = cma_usage_count + 1
    where user_id = p_user_id
    returning cma_usage_count into v_used;
    return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset);
  end if;

  return jsonb_build_object('ok', false, 'message', 'Unknown tool');
end;
$$;

-- ========== 5) 20260319_cma_daily_usage ==========
-- Daily CMA usage limits (anonymous + logged-in + agents)

create table if not exists public.cma_daily_usage (
  subject_key text primary key,
  user_id uuid,
  role text not null default 'anonymous', -- anonymous | user | agent
  cma_usage_count int not null default 0,
  last_reset_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cma_daily_usage_user_id
  on public.cma_daily_usage(user_id);

create index if not exists idx_cma_daily_usage_role
  on public.cma_daily_usage(role);

-- Keep user_profiles in sync with daily counters for future analytics/UI.
alter table if exists public.user_profiles
  add column if not exists cma_usage_count int not null default 0,
  add column if not exists last_reset_date date;

-- ========== 6) 20260319_tasks_schema_compat ==========
-- Compatibility migration for schema drift:
-- Some projects use agents.id as UUID, others as BIGINT.
-- This creates public.tasks with agent_id matching public.agents.id type.

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.tasks (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        lead_id bigint,
        title text not null,
        description text,
        type text not null,
        status text not null default 'pending',
        due_date date not null,
        deferred_until date,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type = 'bigint' then
    execute $sql$
      create table if not exists public.tasks (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        lead_id bigint,
        title text not null,
        description text,
        type text not null,
        status text not null default 'pending',
        due_date date not null,
        deferred_until date,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_tasks_agent_id_status_due_date
  on public.tasks(agent_id, status, due_date);

create index if not exists idx_tasks_agent_id_deferred_until
  on public.tasks(agent_id, deferred_until);

create unique index if not exists idx_tasks_unique_daily
  on public.tasks(agent_id, lead_id, type, due_date, title);

create index if not exists idx_tasks_agent_id_status_updated_at
  on public.tasks(agent_id, status, updated_at desc);

-- ========== 7) 20260319_performance_dashboard ==========
-- Agent Performance Dashboard support
-- Optimizes queries used by /api/performance/*
-- Safe to re-run (IF NOT EXISTS).

-- Tasks: filter by agent + status + updated_at (7‑day windows, trends)
create index if not exists idx_tasks_agent_id_status_updated_at
  on public.tasks(agent_id, status, updated_at desc);

-- Communications: lookups by agent + lead + created_at for response-time metrics
create index if not exists idx_communications_agent_id_lead_id_created_at
  on public.communications(agent_id, lead_id, created_at desc);

-- Lead events: engagement trends over time
create index if not exists idx_lead_events_agent_id_created_at
  on public.lead_events(agent_id, created_at desc);

-- ========== 8) 20260319_daily_briefings ==========
-- Daily AI Briefings — agent_id matches public.agents.id (uuid or bigint).
-- If you have a broken partial table from an old run, run first:
--   drop table if exists public.daily_briefings cascade;

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.daily_briefings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        summary text not null,
        insights jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.daily_briefings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        summary text not null,
        insights jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for daily_briefings: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_daily_briefings_agent_id_created_at
  on public.daily_briefings(agent_id, created_at desc);

-- ========== 9) 20260319_dashboard_drilldown ==========
-- Dashboard drill-down support (overview + filtered lead list)
-- Safe to re-run (IF EXISTS / IF NOT EXISTS).
--
-- NOTE:
-- Most required columns/tables are already created by:
-- - 20250319_leads_followups_and_engagement_all.sql (leads rating/engagement + lead_events + communications)
-- - 20250319_smart_automation.sql (automation_logs)
--
-- This migration just ensures the common dashboard filter indexes exist.

-- Defensive: indexes below require public.leads.created_at (42703 if missing).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'leads'
  ) then
    execute 'alter table public.leads add column if not exists created_at timestamptz';
    execute 'update public.leads set created_at = coalesce(created_at, now()) where created_at is null';
    execute 'alter table public.leads alter column created_at set default now()';
  end if;
end $$;

-- Leads filtering (rating / engagement / last activity) + agent scoping
create index if not exists idx_leads_agent_id_created_at
  on public.leads(agent_id, created_at desc);

create index if not exists idx_leads_agent_id_rating
  on public.leads(agent_id, rating);

create index if not exists idx_leads_agent_id_engagement_score
  on public.leads(agent_id, engagement_score desc);

create index if not exists idx_leads_agent_id_last_activity_at
  on public.leads(agent_id, last_activity_at desc);

-- Activity feed queries
create index if not exists idx_lead_events_created_at
  on public.lead_events(created_at desc);

-- Messages sent metric and timelines
create index if not exists idx_communications_created_at
  on public.communications(created_at desc);

create index if not exists idx_automation_logs_created_at
  on public.automation_logs(created_at desc);

-- ============================================================================
-- End of bundle.
-- ============================================================================
