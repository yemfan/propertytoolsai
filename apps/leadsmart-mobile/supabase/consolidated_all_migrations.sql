-- LeadSmart AI — consolidated migrations (generated)
-- Generated: 2026-03-29T19:00:44.997Z
-- Source: apps/leadsmartai/supabase/migrations (82 files)
-- Excluded: 20250319_reset_all_app_data.sql, 20250319_bundle_all.sql, 20260319_bundle_all.sql, 20260326_full_ai_system_bundle.sql
--
-- On a database that already applied these migrations, expect errors (duplicate objects, etc.).
-- For fresh installs, run against an empty public schema or use supabase db push.

-- ========================================================================
-- FILE: 20250315_users_add_profile_columns.sql
-- ========================================================================

-- Fix: "Could not find the 'full_name' column of 'users' in the schema cache"
-- Run this in Supabase → SQL Editor if public.users exists but is missing columns.

alter table public.users add column if not exists role text;
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists license_number text;
alter table public.users add column if not exists brokerage text;
alter table public.users add column if not exists created_at timestamptz not null default now();

update public.users set role = coalesce(nullif(trim(role), ''), 'user') where role is null;
alter table public.users alter column role set default 'user';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'role' and is_nullable = 'YES'
  ) then
    update public.users set role = 'user' where role is null;
    alter table public.users alter column role set not null;
  end if;
end $$;

-- ========================================================================
-- FILE: 20250319_agents_add_auth_user_id.sql
-- ========================================================================

-- Fix: agents.user_id is BIGINT in older schemas.
-- We store Supabase Auth UUIDs in a dedicated column instead.

alter table if exists public.agents
  add column if not exists auth_user_id uuid;

create index if not exists idx_agents_auth_user_id on public.agents(auth_user_id);
create unique index if not exists idx_agents_auth_user_id_unique
  on public.agents(auth_user_id)
  where auth_user_id is not null;

-- ========================================================================
-- FILE: 20250319_create_user_profiles.sql
-- ========================================================================

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

-- ========================================================================
-- FILE: 20250319_lead_engagement.sql
-- ========================================================================

-- Lead engagement tracking: event log + engagement score

-- 1) lead_events table
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
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

-- 2) leads table: engagement score + last activity
alter table if exists public.leads
  add column if not exists engagement_score int not null default 0,
  add column if not exists last_activity_at timestamptz;

create index if not exists idx_leads_last_activity_at on public.leads(last_activity_at desc);
create index if not exists idx_leads_engagement_score on public.leads(engagement_score desc);

-- 3) Atomic event logging + scoring with debouncing.
-- Debounce windows:
-- - email_open: 10 minutes
-- - report_view: 5 minutes
-- - link_click: 1 minute
create or replace function public.log_lead_event(
  p_lead_id uuid,
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

-- ========================================================================
-- FILE: 20250319_lead_followups.sql
-- ========================================================================

-- Smart Lead Management: rating + follow-up cadence + communications log

-- 1) Leads table fields
alter table if exists public.leads
  add column if not exists rating text not null default 'warm',
  add column if not exists contact_frequency text not null default 'weekly',
  add column if not exists contact_method text not null default 'email',
  add column if not exists last_contacted_at timestamptz,
  add column if not exists next_contact_at timestamptz not null default (now() + interval '7 days');

create index if not exists idx_leads_next_contact_at on public.leads(next_contact_at);
create index if not exists idx_leads_rating on public.leads(rating);

-- 2) Communications log
create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
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

-- ========================================================================
-- FILE: 20250319_leads_followups_and_engagement_all.sql
-- ========================================================================

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

-- ========================================================================
-- FILE: 20250319_smart_automation.sql
-- ========================================================================

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

-- ========================================================================
-- FILE: 20250319_stripe_subscription_fields.sql
-- ========================================================================

-- Stripe subscription sync fields on user_profiles (not legacy public.users).

alter table if exists public.user_profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

create index if not exists idx_user_profiles_stripe_customer_id
  on public.user_profiles(stripe_customer_id);
create index if not exists idx_user_profiles_stripe_subscription_id
  on public.user_profiles(stripe_subscription_id);

-- ========================================================================
-- FILE: 20250319_tokens_and_usage.sql
-- ========================================================================

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

-- ========================================================================
-- FILE: 20250319_users_ensure_user_id.sql
-- ========================================================================

-- Fix: "Could not find the 'user_id' column of 'users' in the schema cache"
-- Run in Supabase → SQL Editor.

-- 1) Ensure the column exists (older DBs may have created `users` without it).
alter table public.users add column if not exists user_id uuid;

-- 2) Do not copy id → user_id: id is often bigint while user_id is uuid (auth). Populate user_id in app / auth link.

-- 3) Ensure `upsert(..., { onConflict: 'user_id' })` works.
create unique index if not exists idx_users_user_id on public.users(user_id);

-- ========================================================================
-- FILE: 20260315000000_create_profiles_table.sql
-- ========================================================================

-- Profiles for Supabase Auth users (separate from legacy public.user_profiles if present).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'consumer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========================================================================
-- FILE: 20260316_leads_score_price_fields.sql
-- ========================================================================

-- Lead marketplace scoring + pricing columns (rules-based engine; safe to re-run)

alter table if exists public.leads
  add column if not exists score int;

alter table if exists public.leads
  add column if not exists price numeric(12, 2);

alter table if exists public.leads
  add column if not exists intent text;

alter table if exists public.leads
  add column if not exists timeframe text;

alter table if exists public.leads
  add column if not exists property_value numeric(14, 2);

alter table if exists public.leads
  add column if not exists location text;

alter table if exists public.leads
  add column if not exists tool_used text;

create index if not exists idx_leads_score_desc on public.leads(score desc nulls last);
create index if not exists idx_leads_price_desc on public.leads(price desc nulls last);

comment on column public.leads.score is 'Rules/ML lead score 0–100 (product engine)';
comment on column public.leads.price is 'Suggested lead price USD (marketplace / monetization)';

-- ========================================================================
-- FILE: 20260316000000_profiles_updated_at_trigger.sql
-- ========================================================================

-- Idempotent: ensures `profiles.updated_at` is maintained on UPDATE.
-- Safe if `20260315000000_create_profiles_table.sql` already included this logic.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ========================================================================
-- FILE: 20260316000000_support_chat_supabase.sql
-- ========================================================================

-- Support chat tables for Supabase Postgres (snake_case).
-- Uses native ENUM types so Prisma enums match the database (see prisma/schema.prisma).
-- If you prefer plain TEXT columns instead of ENUMs, run the block at the bottom of this file
-- and use `npx prisma db pull` to realign the Prisma schema (enums become String).
-- Run in Supabase SQL Editor or: supabase db push / supabase migration up

-- gen_random_uuid() is available on Supabase; enable if your project is minimal:
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (labels must match prisma/schema.prisma enums exactly)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "SupportStatus" AS ENUM (
    'open',
    'waiting_on_support',
    'waiting_on_customer',
    'resolved',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SupportPriority" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageSender" AS ENUM (
    'customer',
    'support',
    'system',
    'ai'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SupportMessageType" AS ENUM (
    'text',
    'system_event',
    'attachment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_user_id uuid NULL,
  subject text NULL,

  status "SupportStatus" NOT NULL DEFAULT 'open',
  priority "SupportPriority" NOT NULL DEFAULT 'normal',

  assigned_agent_id text NULL,
  assigned_agent_name text NULL,

  source text NULL DEFAULT 'website_chat',
  last_message_at timestamptz NULL,
  last_message_by "MessageSender" NULL,

  unread_for_customer integer NOT NULL DEFAULT 0,
  unread_for_support integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,

  sender_type "MessageSender" NOT NULL,
  sender_name text NULL,
  sender_email text NULL,

  body text NOT NULL,
  message_type "SupportMessageType" NOT NULL DEFAULT 'text',
  is_internal_note boolean NOT NULL DEFAULT false,
  metadata jsonb NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_support_conversations_email
  ON support_conversations(customer_email);

CREATE INDEX IF NOT EXISTS idx_support_conversations_status
  ON support_conversations(status);

CREATE INDEX IF NOT EXISTS idx_support_conversations_assigned_agent
  ON support_conversations(assigned_agent_id);

CREATE INDEX IF NOT EXISTS idx_support_conversations_last_message_at
  ON support_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_created
  ON support_messages(conversation_id, created_at);

/*
  ---------------------------------------------------------------------------
  Reference: original TEXT-column DDL (do not run if you already applied above)
  ---------------------------------------------------------------------------
  create table if not exists support_conversations (
    id uuid primary key default gen_random_uuid(),
    public_id text unique not null,
    customer_name text not null,
    customer_email text not null,
    customer_user_id uuid null,
    subject text null,
    status text not null default 'open',
    priority text not null default 'normal',
    assigned_agent_id text null,
    assigned_agent_name text null,
    source text null default 'website_chat',
    last_message_at timestamptz null,
    last_message_by text null,
    unread_for_customer integer not null default 0,
    unread_for_support integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists support_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references support_conversations(id) on delete cascade,
    sender_type text not null,
    sender_name text null,
    sender_email text null,
    body text not null,
    message_type text not null default 'text',
    is_internal_note boolean not null default false,
    metadata jsonb null,
    created_at timestamptz not null default now()
  );

  create index if not exists idx_support_conversations_email
    on support_conversations(customer_email);
  create index if not exists idx_support_conversations_status
    on support_conversations(status);
  create index if not exists idx_support_conversations_last_message_at
    on support_conversations(last_message_at desc);
  create index if not exists idx_support_messages_conversation_created
    on support_messages(conversation_id, created_at);
*/

-- ========================================================================
-- FILE: 20260317000000_profiles_rbac_rls_auth_trigger.sql
-- ========================================================================

-- RBAC: canonical roles on public.profiles + auto-provision on signup + RLS.
-- Roles: admin | agent | loan_broker | support | consumer

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (
    role in ('admin', 'agent', 'loan_broker', 'support', 'consumer')
  );

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), ''),
  'consumer'::text
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), ''),
    'consumer'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case
      when nullif(excluded.full_name, '') is not null then excluded.full_name
      else public.profiles.full_name
    end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- ========================================================================
-- FILE: 20260319_cma_daily_usage.sql
-- ========================================================================

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

-- ========================================================================
-- FILE: 20260319_daily_briefings.sql
-- ========================================================================

-- Daily AI Briefings
-- Stores one actionable briefing per agent per day.
-- agent_id type matches public.agents.id (uuid or bigint).

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

-- ========================================================================
-- FILE: 20260319_dashboard_drilldown.sql
-- ========================================================================

-- Dashboard drill-down support (overview + filtered lead list)
-- Safe to re-run (IF EXISTS / IF NOT EXISTS).
--
-- NOTE:
-- Most required columns/tables are already created by:
-- - 20250319_leads_followups_and_engagement_all.sql (leads rating/engagement + lead_events + communications)
-- - 20250319_smart_automation.sql (automation_logs)
--
-- This migration just ensures the common dashboard filter indexes exist.

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

-- ========================================================================
-- FILE: 20260319_free_trial_subscription.sql
-- ========================================================================

-- Free trial fields for plan gating

alter table if exists public.user_profiles
  add column if not exists trial_used boolean not null default false,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

create index if not exists idx_user_profiles_trial_ends_at
  on public.user_profiles(trial_ends_at);

-- ========================================================================
-- FILE: 20260319_leads_progressive_capture.sql
-- ========================================================================

-- Progressive Lead Capture fields

alter table if exists public.leads
  add column if not exists stage text,
  add column if not exists source text,
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists phone text;

create index if not exists idx_leads_stage on public.leads(stage);
create index if not exists idx_leads_email on public.leads(email);

-- ========================================================================
-- FILE: 20260319_performance_dashboard.sql
-- ========================================================================

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

-- ========================================================================
-- FILE: 20260319_tasks_ensure_exists.sql
-- ========================================================================

-- Safety migration: ensure tasks table exists before performance indexes.
-- Use this if migrations were run out of order.

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
);

create index if not exists idx_tasks_agent_id_status_due_date
  on public.tasks(agent_id, status, due_date);

create index if not exists idx_tasks_agent_id_deferred_until
  on public.tasks(agent_id, deferred_until);

create unique index if not exists idx_tasks_unique_daily
  on public.tasks(agent_id, lead_id, type, due_date, title);

create index if not exists idx_tasks_agent_id_status_updated_at
  on public.tasks(agent_id, status, updated_at desc);

-- ========================================================================
-- FILE: 20260319_tasks_schema_compat.sql
-- ========================================================================

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

-- ========================================================================
-- FILE: 20260319_tasks.sql
-- ========================================================================

-- Task Management for Daily AI Briefing

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  -- leads.id is BIGINT in this project
  lead_id bigint,
  title text not null,
  description text,
  type text not null, -- call | email | follow_up
  status text not null default 'pending', -- pending | done | skipped | deferred
  due_date date not null,
  deferred_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_agent_id_status_due_date
  on public.tasks(agent_id, status, due_date);

create index if not exists idx_tasks_agent_id_deferred_until
  on public.tasks(agent_id, deferred_until);

-- Prevent obvious duplicates for a given day per lead/type/title
create unique index if not exists idx_tasks_unique_daily
  on public.tasks(agent_id, lead_id, type, due_date, title);

-- ========================================================================
-- FILE: 20260319_usage_limits.sql
-- ========================================================================

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

-- ========================================================================
-- FILE: 20260319_user_profiles_add_phone.sql
-- ========================================================================

-- Add phone field for signup + agent onboarding

alter table if exists public.user_profiles
  add column if not exists phone text;

create index if not exists idx_user_profiles_phone
  on public.user_profiles(phone);

-- ========================================================================
-- FILE: 20260320_lead_marketplace_system.sql
-- ========================================================================

-- Lead Marketplace System (tool usage -> opportunities -> agent purchase -> CRM leads)
-- Implements:
-- - tool_usage_logs
-- - opportunities with dynamic pricing
-- - SQL function to log usage + auto-generate/update opportunities
-- - SQL function to buy an opportunity (deduct credits + create exclusive lead)
-- - extends existing CRM `public.leads` with marketplace fields

-- =========================
-- TOOL USAGE LOGS
-- =========================
create table if not exists public.tool_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  session_id text not null,
  tool_name text not null,
  property_address text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tool_usage_logs_user_id_created_at
  on public.tool_usage_logs(user_id, created_at desc);
create index if not exists idx_tool_usage_logs_session_id_created_at
  on public.tool_usage_logs(session_id, created_at desc);
create index if not exists idx_tool_usage_logs_property_address_created_at
  on public.tool_usage_logs(property_address, created_at desc);
create index if not exists idx_tool_usage_logs_tool_name_created_at
  on public.tool_usage_logs(tool_name, created_at desc);

-- =========================
-- OPPORTUNITIES
-- =========================
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  property_address text not null,
  lead_type text not null,
  intent_score int not null default 0,
  usage_count int not null default 0,
  estimated_value numeric,
  status text not null default 'available',
  assigned_agent_id uuid,
  price int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_status_check check (status in ('available', 'sold', 'assigned'))
);

-- We keep 1 active "opportunity" record per address+lead_type so the intent/price
-- can be continuously updated. Once sold, that record is no longer available.
create unique index if not exists idx_opportunities_property_address_lead_type
  on public.opportunities(property_address, lead_type);

create index if not exists idx_opportunities_status
  on public.opportunities(status);
create index if not exists idx_opportunities_lead_type
  on public.opportunities(lead_type);
create index if not exists idx_opportunities_property_address
  on public.opportunities(property_address);
create index if not exists idx_opportunities_price
  on public.opportunities(price);

-- =========================
-- MARKETPLACE HELPERS
-- =========================
create or replace function public.marketplace_map_tool_to_lead_type(p_tool_name text)
returns text
language plpgsql
as $$
begin
  if lower(coalesce(p_tool_name, '')) in ('estimator', 'cma') then
    return 'seller';
  elsif lower(coalesce(p_tool_name, '')) = 'mortgage' then
    -- Spec allows buyer/refi; for now we classify mortgage as buyer.
    return 'buyer';
  elsif lower(coalesce(p_tool_name, '')) = 'rental' then
    return 'buyer';
  end if;

  return 'seller';
end;
$$;

create or replace function public.marketplace_compute_intent_score(
  p_usage_count int,
  p_action text
)
returns int
language plpgsql
as $$
declare
  v_usage int := coalesce(p_usage_count, 0);
  v_score int;
begin
  -- Spec: intent_score based on usage frequency.
  -- Baseline + frequency scaling; submit actions get a small boost.
  v_score := 10 + (v_usage * 20);

  if lower(coalesce(p_action, '')) = 'submit' then
    v_score := v_score + 20;
  end if;

  return least(100, greatest(0, v_score));
end;
$$;

create or replace function public.marketplace_compute_price(
  p_intent_score int,
  p_estimated_value numeric,
  p_usage_count int
)
returns int
language plpgsql
as $$
declare
  v_price int := 10; -- base
begin
  -- Spec dynamic pricing rules
  if coalesce(p_intent_score, 0) > 70 then
    v_price := v_price + 20;
  end if;

  if p_estimated_value is not null and p_estimated_value > 1000000 then
    v_price := v_price + 30;
  end if;

  if coalesce(p_usage_count, 0) > 3 then
    v_price := v_price + 15;
  end if;

  return v_price;
end;
$$;

-- =========================
-- LOG USAGE + AUTO-UPsert OPPORTUNITY
-- =========================
create or replace function public.log_tool_usage_and_update_opportunity(
  p_user_id uuid,
  p_session_id text,
  p_tool_name text,
  p_property_address text,
  p_action text,
  p_estimated_value numeric default null
)
returns jsonb
language plpgsql
as $$
declare
  v_lead_type text;
  v_property_address text := trim(coalesce(p_property_address, ''));
  v_action text := lower(coalesce(p_action, 'view'));
  v_session_id text := coalesce(nullif(trim(p_session_id), ''), 'unknown');
  v_usage_count int;
  v_intent_score int;
  v_existing_estimated_value numeric;
  v_estimated_value numeric;
  v_price int;
begin
  if v_property_address = '' then
    return jsonb_build_object('ok', false, 'message', 'property_address is required');
  end if;

  v_lead_type := public.marketplace_map_tool_to_lead_type(p_tool_name);

  insert into public.tool_usage_logs(user_id, session_id, tool_name, property_address, action)
  values (p_user_id, v_session_id, lower(coalesce(p_tool_name, '')), v_property_address, v_action);

  select count(*)
    into v_usage_count
  from public.tool_usage_logs
  where property_address = v_property_address
    and created_at >= now() - interval '90 days'
    and public.marketplace_map_tool_to_lead_type(tool_name) = v_lead_type;

  v_intent_score := public.marketplace_compute_intent_score(v_usage_count, v_action);

  select estimated_value
    into v_existing_estimated_value
  from public.opportunities
  where property_address = v_property_address
    and lead_type = v_lead_type
  limit 1;

  v_estimated_value := coalesce(p_estimated_value, v_existing_estimated_value);
  v_price := public.marketplace_compute_price(v_intent_score, v_estimated_value, v_usage_count);

  insert into public.opportunities(
    property_address,
    lead_type,
    intent_score,
    usage_count,
    estimated_value,
    status,
    price
  )
  values (
    v_property_address,
    v_lead_type,
    v_intent_score,
    v_usage_count,
    v_estimated_value,
    'available',
    v_price
  )
  on conflict (property_address, lead_type) do update set
    -- Once an opportunity is sold, keep it sold (do not change price/intent anymore).
    intent_score = case when opportunities.status = 'available' then excluded.intent_score else opportunities.intent_score end,
    usage_count = case when opportunities.status = 'available' then excluded.usage_count else opportunities.usage_count end,
    estimated_value = coalesce(excluded.estimated_value, opportunities.estimated_value),
    price = case when opportunities.status = 'available' then excluded.price else opportunities.price end,
    status = opportunities.status,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'lead_type', v_lead_type,
    'property_address', v_property_address,
    'usage_count', v_usage_count,
    'intent_score', v_intent_score,
    'estimated_value', v_estimated_value,
    'price', v_price
  );
end;
$$;

-- =========================
-- BUY OPPORTUNITY (ATOMIC)
-- =========================
create or replace function public.buy_opportunity(
  p_user_id uuid,
  p_agent_id uuid,
  p_opportunity_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_opp record;
  v_consumption jsonb;
  v_lead_id bigint;
  v_rating text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Not authenticated', 'status_code', 401);
  end if;

  if p_agent_id is null then
    return jsonb_build_object('ok', false, 'message', 'Agent is required', 'status_code', 400);
  end if;

  select *
    into v_opp
  from public.opportunities
  where id = p_opportunity_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Opportunity not found', 'status_code', 404);
  end if;

  if v_opp.status <> 'available' then
    return jsonb_build_object('ok', false, 'message', 'Opportunity not available', 'status_code', 409);
  end if;

  -- Deduct marketplace credits.
  -- Assumption: opportunity.price is an integer "credits" amount ($1 == 1 credit).
  v_consumption := public.consume_tokens(p_user_id, 'marketplace_lead', coalesce(v_opp.price, 0));
  if (v_consumption->>'ok')::boolean is distinct from true then
    return jsonb_build_object(
      'ok', false,
      'message', v_consumption->>'message',
      'status_code', 402,
      'plan', v_consumption->>'plan',
      'tokens_remaining', (v_consumption->>'tokens_remaining')::int
    );
  end if;

  v_rating := case when coalesce(v_opp.intent_score, 0) > 70 then 'hot' else 'warm' end;

  -- Insert lead (exclusive by marketplace_opportunity_id).
  begin
    insert into public.leads(
      agent_id,
      property_address,
      lead_type,
      contact_info,
      source,
      lead_status,
      notes,
      rating,
      contact_frequency,
      contact_method,
      next_contact_at,
      marketplace_opportunity_id
    )
    values (
      p_agent_id,
      v_opp.property_address,
      v_opp.lead_type,
      null,
      'marketplace',
      'new',
      null,
      v_rating,
      'weekly',
      'email',
      now() + interval '7 days',
      v_opp.id
    )
    returning id into v_lead_id;
  exception
    when unique_violation then
      select id into v_lead_id
      from public.leads
      where marketplace_opportunity_id = v_opp.id
      limit 1;
  end;

  update public.opportunities
  set status = 'sold',
      assigned_agent_id = p_agent_id,
      updated_at = now()
  where id = p_opportunity_id;

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'opportunity_id', p_opportunity_id,
    'price', v_opp.price
  );
end;
$$;

-- =========================
-- EXTEND CRM LEADS WITH MARKETPLACE FIELDS
-- =========================
alter table if exists public.leads
  add column if not exists lead_type text;

alter table if exists public.leads
  add column if not exists contact_info text;

alter table if exists public.leads
  add column if not exists marketplace_opportunity_id uuid;

create unique index if not exists idx_leads_marketplace_opportunity_unique
  on public.leads(marketplace_opportunity_id)
  where marketplace_opportunity_id is not null;

create index if not exists idx_leads_marketplace_opportunity_id
  on public.leads(marketplace_opportunity_id);

create index if not exists idx_leads_lead_type
  on public.leads(lead_type);

-- ========================================================================
-- FILE: 20260320000000_user_profiles_role_broker_support.sql
-- ========================================================================

-- Standard values for public.user_profiles.role (text; enforced in app code).
-- Includes broker + support for LeadSmart AI / PropertyTools dashboards.
-- @see apps/leadsmartai/docs/USER_ROLES.md

comment on column public.user_profiles.role is
'Application role (examples): user, agent, broker, support, admin, broker_owner, managing_broker, team_lead, brokerage_admin, owner, partner, anonymous.';

-- ========================================================================
-- FILE: 20260321_auto_lead_nurturing_system.sql
-- ========================================================================

-- Auto Lead Nurturing System (lead_sequences -> sequence_steps -> message_logs)
-- Runs in parallel with existing tooling; cron + tracking endpoints will write to these tables.

-- =========================
-- Leads: nurture score
-- =========================
alter table if exists public.leads
  add column if not exists nurture_score int not null default 0;

create index if not exists idx_leads_nurture_score on public.leads(nurture_score desc);

-- =========================
-- Templates
-- =========================
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null, -- seller | buyer
  channel text not null,   -- email | sms
  template_text text not null,
  created_at timestamptz not null default now(),
  constraint message_templates_lead_type_channel_check
    check (lower(lead_type) in ('seller','buyer') and lower(channel) in ('email','sms'))
);

create index if not exists idx_message_templates_lead_type_channel
  on public.message_templates(lead_type, channel);

-- Seed 4 templates (safe to re-run)
do $$
begin
  if not exists (
    select 1 from public.message_templates
    where lower(lead_type) = 'seller' and lower(channel) = 'email'
  ) then
    insert into public.message_templates(lead_type, channel, template_text)
    values (
      'seller',
      'email',
      'Hi {name},{city ? " " + city : ""} quick follow-up on your home value request.\n\nYour estimated home value: {home_value}.\n\nIf you want, reply to this email and your agent ({agent_name}) will walk you through next steps for pricing and timing.\n\n— LeadSmart AI'
    );
  end if;

  if not exists (
    select 1 from public.message_templates
    where lower(lead_type) = 'seller' and lower(channel) = 'sms'
  ) then
    insert into public.message_templates(lead_type, channel, template_text)
    values (
      'seller',
      'sms',
      'Hi {name} — quick follow-up from LeadSmart AI. Est. home value in {city}: {home_value}. Reply if you want {agent_name} to help with pricing.'
    );
  end if;

  if not exists (
    select 1 from public.message_templates
    where lower(lead_type) = 'buyer' and lower(channel) = 'email'
  ) then
    insert into public.message_templates(lead_type, channel, template_text)
    values (
      'buyer',
      'email',
      'Hi {name},\n\nThanks for requesting your mortgage rate estimate. Based on your address, here’s your current monthly target: {home_value}.\n\nWant a lender-ready next step? Reply to this email and {agent_name} will reach out with a quick plan.\n\n— LeadSmart AI'
    );
  end if;

  if not exists (
    select 1 from public.message_templates
    where lower(lead_type) = 'buyer' and lower(channel) = 'sms'
  ) then
    insert into public.message_templates(lead_type, channel, template_text)
    values (
      'buyer',
      'sms',
      'Hi {name} — mortgage update from LeadSmart AI. Est. monthly target: {home_value}. Reply if you want {agent_name} to help with next steps.'
    );
  end if;
end $$;

-- =========================
-- Lead sequences (per lead)
-- =========================
create table if not exists public.lead_sequences (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null,
  current_step int not null default 0,
  status text not null default 'active', -- active | paused | completed
  next_send_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint lead_sequences_status_check check (status in ('active','paused','completed'))
);

-- One active sequence per lead (we still allow completed history by updating in-place).
create unique index if not exists idx_lead_sequences_unique_lead_id on public.lead_sequences(lead_id);

create index if not exists idx_lead_sequences_status_next_send_at
  on public.lead_sequences(status, next_send_at);

-- =========================
-- Sequence steps (per sequence)
-- =========================
create table if not exists public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.lead_sequences(id) on delete cascade,
  day_offset int not null default 0, -- days after lead.created_at
  channel text not null,             -- email | sms
  template_id uuid not null references public.message_templates(id) on delete restrict,
  sent boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sequence_steps_channel_check check (lower(channel) in ('email','sms'))
);

create index if not exists idx_sequence_steps_sequence_id_sent
  on public.sequence_steps(sequence_id, sent);

create unique index if not exists idx_sequence_steps_unique_order
  on public.sequence_steps(sequence_id, day_offset, channel);

-- =========================
-- Message logs
-- =========================
create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null,
  type text not null, -- email | sms
  status text not null, -- sent | opened | clicked | replied
  created_at timestamptz not null default now(),
  constraint message_logs_type_check check (lower(type) in ('email','sms')),
  constraint message_logs_status_check check (status in ('sent','opened','clicked','replied'))
);

create index if not exists idx_message_logs_lead_id_created_at
  on public.message_logs(lead_id, created_at desc);

-- =========================
-- Helper: update nurture score + derive temperature rating
-- =========================
create or replace function public.marketplace_apply_nurture_score(
  p_lead_id bigint,
  p_delta int
)
returns jsonb
language plpgsql
as $$
declare
  v_new_score int;
  v_new_rating text;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'message', 'lead_id required');
  end if;

  update public.leads
    set nurture_score = greatest(0, nurture_score + coalesce(p_delta,0))
  where id = p_lead_id
  returning nurture_score into v_new_score;

  -- Temperature mapping:
  -- cold: <3, warm: 3-6, hot: >=7
  v_new_rating :=
    case
      when coalesce(v_new_score,0) >= 7 then 'hot'
      when coalesce(v_new_score,0) >= 3 then 'warm'
      else 'cold'
    end;

  update public.leads
    set rating = v_new_rating
  where id = p_lead_id;

  return jsonb_build_object('ok', true, 'new_score', v_new_score, 'rating', v_new_rating);
end;
$$;

-- =========================
-- Agent alerts
-- =========================
create table if not exists public.nurture_alerts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid,
  lead_id bigint not null,
  type text not null, -- hot | replied
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_nurture_alerts_agent_id_created_at
  on public.nurture_alerts(agent_id, created_at desc);
create index if not exists idx_nurture_alerts_lead_id_created_at
  on public.nurture_alerts(lead_id, created_at desc);

-- ========================================================================
-- FILE: 20260321_auto_lead_nurturing_templates_fix.sql
-- ========================================================================

-- Fix seeded template placeholders (simple {placeholder} replacement only)

update public.message_templates
set template_text = 'Hi {name}, quick follow-up on your home value request.\n\nYour estimated home value: {home_value}.\n\nIf you want, reply to this email and your agent ({agent_name}) will walk you through next steps for pricing and timing.\n\nCity: {city}\n\n— LeadSmart AI'
where lower(lead_type) = 'seller' and lower(channel) = 'email';

-- ========================================================================
-- FILE: 20260322_twilio_sms_integration.sql
-- ========================================================================

-- Twilio SMS integration support (phone_number + sms_opt_in + message_logs received/content)

-- =========================
-- LEADS: phone_number + sms_opt_in
-- =========================
alter table if exists public.leads
  add column if not exists phone_number text,
  add column if not exists sms_opt_in boolean not null default false;

-- Best-effort backfill phone_number from phone if present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='leads' and column_name='phone'
  ) then
    update public.leads
      set phone_number = phone
    where phone_number is null
      and phone is not null;
  end if;
end $$;

create index if not exists idx_leads_phone_number on public.leads(phone_number);
create index if not exists idx_leads_sms_opt_in on public.leads(sms_opt_in);

-- =========================
-- MESSAGE_LOGS: content + received
-- =========================
alter table if exists public.message_logs
  add column if not exists content text;

-- Expand status enum-like check constraint to include 'received'.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'message_logs_status_check') then
    alter table public.message_logs drop constraint message_logs_status_check;
  end if;
end $$;

alter table if exists public.message_logs
  add constraint message_logs_status_check check (status in ('sent', 'opened', 'clicked', 'replied', 'received'));

create index if not exists idx_message_logs_type_status_created_at
  on public.message_logs(type, status, created_at desc);

-- ========================================================================
-- FILE: 20260323_ai_sms_responder.sql
-- ========================================================================

-- AI SMS responder conversation storage

create table if not exists public.sms_conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  stage text not null default 'new', -- new | warm | hot
  last_ai_reply_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_conversations_lead_id on public.sms_conversations(lead_id);
create index if not exists idx_sms_conversations_last_ai_reply_at
  on public.sms_conversations(last_ai_reply_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sms_conversations'
      and column_name = 'stage'
  ) then
    -- Ensure stage is valid; if the constraint exists already, ignore.
    if not exists (
      select 1
      from pg_constraint
      where conname = 'sms_conversations_stage_check'
    ) then
      alter table public.sms_conversations
        add constraint sms_conversations_stage_check
          check (lower(stage) in ('new','warm','hot'));
    end if;
  end if;
end $$;

-- ========================================================================
-- FILE: 20260324_sms_conversations_unique.sql
-- ========================================================================

-- Ensure one sms_conversation per lead_id

create unique index if not exists idx_sms_conversations_lead_id_unique
  on public.sms_conversations(lead_id);

-- ========================================================================
-- FILE: 20260325_traffic_generation_system.sql
-- ========================================================================

-- Traffic generation + attribution tracking

alter table if exists public.leads
  add column if not exists traffic_source text,
  add column if not exists lead_quality text;

create index if not exists idx_leads_traffic_source on public.leads(traffic_source);
create index if not exists idx_leads_lead_quality on public.leads(lead_quality);

create table if not exists public.traffic_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- page_view | conversion
  page_path text not null,
  city text,
  source text,
  campaign text,
  lead_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_traffic_events_event_type_created_at
  on public.traffic_events(event_type, created_at desc);
create index if not exists idx_traffic_events_page_path_created_at
  on public.traffic_events(page_path, created_at desc);
create index if not exists idx_traffic_events_source_created_at
  on public.traffic_events(source, created_at desc);
create index if not exists idx_traffic_events_lead_id_created_at
  on public.traffic_events(lead_id, created_at desc);

-- ========================================================================
-- FILE: 20260326_ai_lead_pricing_engine.sql
-- ========================================================================

-- AI-driven lead pricing engine

create table if not exists public.lead_pricing_weights (
  id uuid primary key default gen_random_uuid(),
  model_version text not null default 'v1',
  behavior_weight numeric(6,4) not null default 0.25,
  engagement_weight numeric(6,4) not null default 0.25,
  profile_weight numeric(6,4) not null default 0.25,
  market_weight numeric(6,4) not null default 0.25,
  base_price numeric(10,2) not null default 10,
  updated_from_learning boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_pricing_weights_model_created
  on public.lead_pricing_weights(model_version, created_at desc);

create table if not exists public.lead_pricing_predictions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid null references public.opportunities(id) on delete set null,
  lead_id bigint null references public.leads(id) on delete set null,
  property_address text,
  city text,
  state text,
  model_version text not null default 'v1',
  behavior_score numeric(8,2) not null default 0,
  engagement_score numeric(8,2) not null default 0,
  profile_score numeric(8,2) not null default 0,
  market_score numeric(8,2) not null default 0,
  lead_score numeric(8,2) not null default 0,
  score_multiplier numeric(8,4) not null default 1,
  demand_multiplier numeric(8,4) not null default 1,
  price_credits int not null default 0,
  commission_value numeric(12,2) not null default 0,
  close_probability numeric(8,4) not null default 0,
  expected_revenue numeric(12,2) not null default 0,
  explanation text not null default '',
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_pricing_predictions_created
  on public.lead_pricing_predictions(created_at desc);
create index if not exists idx_lead_pricing_predictions_opportunity
  on public.lead_pricing_predictions(opportunity_id, created_at desc);
create index if not exists idx_lead_pricing_predictions_lead
  on public.lead_pricing_predictions(lead_id, created_at desc);

insert into public.lead_pricing_weights (
  model_version,
  behavior_weight,
  engagement_weight,
  profile_weight,
  market_weight,
  base_price,
  updated_from_learning,
  notes
)
select
  'v1',
  0.25,
  0.25,
  0.25,
  0.25,
  10,
  false,
  'Initial equal-weight baseline.'
where not exists (
  select 1 from public.lead_pricing_weights where model_version = 'v1'
);

-- ========================================================================
-- FILE: 20260326_ai_lead_scoring_system.sql
-- ========================================================================

-- Production-ready AI Lead Scoring System

-- 1) Ensure leads has required columns (safe/idempotent)
alter table if exists public.leads
  add column if not exists city text,
  add column if not exists zip_code text,
  add column if not exists estimated_home_value numeric(12,2);

create index if not exists idx_leads_city on public.leads(city);
create index if not exists idx_leads_zip_code on public.leads(zip_code);
create index if not exists idx_leads_estimated_home_value on public.leads(estimated_home_value);

-- 2) Ensure lead_events exists with compatible lead_id type
do $$
declare
  v_leads_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into v_leads_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'leads'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_leads_id_type is null then
    v_leads_id_type := 'bigint';
  end if;

  execute format(
    'create table if not exists public.lead_events (
      id uuid primary key default gen_random_uuid(),
      lead_id %s not null references public.leads(id) on delete cascade,
      event_type text not null,
      metadata jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now()
    )',
    v_leads_id_type
  );
end $$;

create index if not exists idx_lead_events_lead_created
  on public.lead_events(lead_id, created_at desc);
create index if not exists idx_lead_events_type_created
  on public.lead_events(event_type, created_at desc);

-- 3) New lead_scores table (compatible lead_id type)
do $$
declare
  v_leads_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into v_leads_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'leads'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_leads_id_type is null then
    v_leads_id_type := 'bigint';
  end if;

  execute format(
    'create table if not exists public.lead_scores (
      id uuid primary key default gen_random_uuid(),
      lead_id %s not null references public.leads(id) on delete cascade,
      score numeric(8,2) not null default 0,
      intent text not null default ''low'',
      timeline text not null default ''6+ months'',
      confidence numeric(8,4) not null default 0.2,
      explanation jsonb not null default ''[]''::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )',
    v_leads_id_type
  );
end $$;

create index if not exists idx_lead_scores_lead_updated
  on public.lead_scores(lead_id, updated_at desc);
create index if not exists idx_lead_scores_score_updated
  on public.lead_scores(score desc, updated_at desc);

-- ========================================================================
-- FILE: 20260326_ai_sms_auto_follow_purchase.sql
-- ========================================================================

-- AI SMS auto-follow system for purchased leads

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  agent_id uuid,
  message text not null,
  direction text not null,
  created_at timestamptz not null default now(),
  constraint sms_messages_direction_check check (direction in ('inbound','outbound'))
);

create index if not exists idx_sms_messages_lead_created
  on public.sms_messages(lead_id, created_at desc);
create index if not exists idx_sms_messages_agent_created
  on public.sms_messages(agent_id, created_at desc);

alter table if exists public.leads
  add column if not exists sms_ai_enabled boolean not null default true,
  add column if not exists sms_agent_takeover boolean not null default false,
  add column if not exists sms_followup_stage int not null default 0,
  add column if not exists sms_last_outbound_at timestamptz,
  add column if not exists sms_last_inbound_at timestamptz,
  add column if not exists sms_opted_out_at timestamptz;

create index if not exists idx_leads_sms_ai_enabled on public.leads(sms_ai_enabled);
create index if not exists idx_leads_sms_agent_takeover on public.leads(sms_agent_takeover);
create index if not exists idx_leads_sms_followup_stage on public.leads(sms_followup_stage);
create index if not exists idx_leads_sms_last_outbound_at on public.leads(sms_last_outbound_at desc);

-- ========================================================================
-- FILE: 20260326_city_market_data_engine.sql
-- ========================================================================

-- City-level market data engine for programmatic SEO pages

create table if not exists public.city_market_data (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text not null,
  median_price numeric(12,2) not null default 0,
  price_per_sqft numeric(10,2) not null default 0,
  trend text not null default 'stable',
  days_on_market integer not null default 0,
  inventory integer not null default 0,
  source text not null default 'fallback',
  raw_payload jsonb not null default '{}'::jsonb,
  ai_market_summary text,
  ai_seller_recommendation text,
  last_fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint city_market_data_trend_check check (trend in ('up', 'down', 'stable'))
);

create unique index if not exists uq_city_market_data_city_state
  on public.city_market_data (city, state);

create index if not exists idx_city_market_data_expires_at
  on public.city_market_data (expires_at);

create index if not exists idx_city_market_data_last_fetched
  on public.city_market_data (last_fetched_at desc);

-- ========================================================================
-- FILE: 20260326_leadsmart_backend_layer.sql
-- ========================================================================

-- LeadSmart AI production backend layer

create table if not exists public.leadsmart_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  status text not null default 'success',
  model text,
  score numeric(8,2),
  intent text,
  timeline text,
  confidence numeric(8,4),
  explanation jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  latency_ms int,
  error text,
  created_at timestamptz not null default now(),
  constraint leadsmart_runs_status_check check (status in ('success','error'))
);

create index if not exists idx_leadsmart_runs_lead_created
  on public.leadsmart_runs(lead_id, created_at desc);

create index if not exists idx_leadsmart_runs_status_created
  on public.leadsmart_runs(status, created_at desc);

-- ========================================================================
-- FILE: 20260326000000_user_profiles_billing_admin_columns.sql
-- ========================================================================

-- Optional columns for admin billing UI + future Stripe period sync.
alter table if exists public.user_profiles
  add column if not exists subscription_current_period_start timestamptz,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

comment on column public.user_profiles.subscription_current_period_start is 'Stripe current period start (admin billing / analytics).';
comment on column public.user_profiles.subscription_current_period_end is 'Stripe current period end (admin billing / analytics).';
comment on column public.user_profiles.subscription_cancel_at_period_end is 'True if subscription cancels at period end.';

-- ========================================================================
-- FILE: 20260327_leadsmart_ai_layer.sql
-- ========================================================================

-- LeadSmart AI: cache, usage tracking, rate-limit data

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  prompt_hash text not null,
  response text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_ai_cache_prompt_hash on public.ai_cache (prompt_hash);
create index if not exists idx_ai_cache_created_at on public.ai_cache (created_at desc);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  tokens_used int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_created on public.ai_usage(user_id, created_at desc);
create index if not exists idx_ai_usage_tool_created on public.ai_usage(tool, created_at desc);

-- ========================================================================
-- FILE: 20260328_comparison_reports.sql
-- ========================================================================

-- AI Property Comparison Reports (shareable public links + PDF export)

create table if not exists public.comparison_reports (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  client_name text not null default '',
  properties jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Optional FK when agents.id is uuid (safe if table exists)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'agents'
  ) then
    alter table public.comparison_reports
      drop constraint if exists comparison_reports_agent_id_fkey;
    alter table public.comparison_reports
      add constraint comparison_reports_agent_id_fkey
      foreign key (agent_id) references public.agents(id) on delete cascade;
  end if;
exception when others then
  null;
end $$;

create index if not exists idx_comparison_reports_agent_created
  on public.comparison_reports(agent_id, created_at desc);

comment on table public.comparison_reports is 'Agent-generated property comparison reports; public read via server routes only';

-- ========================================================================
-- FILE: 20260329_agent_ai_assistant.sql
-- ========================================================================

-- Agent-side AI assistant: conversation memory + scheduled follow-ups
-- agent_id type matches public.agents.id (uuid OR bigint — see 20260319_tasks_schema_compat.sql)

alter table if exists public.agents
  add column if not exists ai_assistant_enabled boolean not null default true,
  add column if not exists ai_assistant_mode text not null default 'manual'
    check (ai_assistant_mode in ('auto', 'manual'));

comment on column public.agents.ai_assistant_enabled is 'Master switch for AI-generated replies & follow-ups.';
comment on column public.agents.ai_assistant_mode is 'auto: send AI replies without agent approval when safe; manual: suggest only.';

do $$
declare
  v_agent_type text;
  v_agent_id_typ oid;
  v_lc_typ oid;
  v_job_typ oid;
begin
  select a.atttypid, a.atttypid::regtype::text
    into v_agent_id_typ, v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_id_typ is null then
    raise exception 'public.agents.id not found';
  end if;

  -- If either table exists from a failed migration with the wrong agent_id type, drop both.
  select a.atttypid into v_lc_typ
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'lead_conversations'
    and a.attname = 'agent_id'
    and a.attnum > 0
    and not a.attisdropped;

  select a.atttypid into v_job_typ
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'ai_followup_jobs'
    and a.attname = 'agent_id'
    and a.attnum > 0
    and not a.attisdropped;

  if (v_lc_typ is not null and v_lc_typ <> v_agent_id_typ)
     or (v_job_typ is not null and v_job_typ <> v_agent_id_typ) then
    drop table if exists public.ai_followup_jobs cascade;
    drop table if exists public.lead_conversations cascade;
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.lead_conversations (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id uuid references public.agents(id) on delete set null,
        messages jsonb not null default '[]'::jsonb,
        preferences jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        unique (lead_id)
      )
    $sql$;
    execute $sql$
      create table if not exists public.ai_followup_jobs (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id uuid references public.agents(id) on delete set null,
        kind text not null check (kind in ('1h', '24h', '3d')),
        run_at timestamptz not null,
        status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'skipped', 'cancelled', 'failed')),
        last_error text,
        created_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.lead_conversations (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id bigint references public.agents(id) on delete set null,
        messages jsonb not null default '[]'::jsonb,
        preferences jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        unique (lead_id)
      )
    $sql$;
    execute $sql$
      create table if not exists public.ai_followup_jobs (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id bigint references public.agents(id) on delete set null,
        kind text not null check (kind in ('1h', '24h', '3d')),
        run_at timestamptz not null,
        status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'skipped', 'cancelled', 'failed')),
        last_error text,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_lead_conversations_lead_id on public.lead_conversations(lead_id);
create index if not exists idx_lead_conversations_agent_id on public.lead_conversations(agent_id);

comment on table public.lead_conversations is 'AI assistant thread: messages[{role,content,created_at,source?}], preferences{tone?, channel?}';

create index if not exists idx_ai_followup_jobs_run_status
  on public.ai_followup_jobs(run_at, status)
  where status = 'scheduled';

create index if not exists idx_ai_followup_jobs_lead on public.ai_followup_jobs(lead_id);

-- ========================================================================
-- FILE: 20260330_client_portal.sql
-- ========================================================================

-- Buyer/Seller client portal: chat + saved homes (service-role API enforces access)

create table if not exists public.client_portal_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'agent')),
  sender_auth_user_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_portal_messages_lead_created
  on public.client_portal_messages(lead_id, created_at asc);

comment on table public.client_portal_messages is 'Client ↔ agent thread; API verifies lead email matches authenticated user for client sends.';

create table if not exists public.client_saved_homes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  lead_id bigint references public.leads(id) on delete set null,
  address text not null,
  ai_score int,
  insights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_saved_homes_user on public.client_saved_homes(auth_user_id, updated_at desc);

comment on table public.client_saved_homes is 'Mobile client saved listings; scoped by Supabase auth user id.';

create table if not exists public.client_portal_documents (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  title text not null,
  doc_type text not null default 'file' check (doc_type in ('file', 'link', 'report')),
  url text,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_portal_documents_lead on public.client_portal_documents(lead_id, created_at desc);

comment on table public.client_portal_documents is 'Agent-published docs for a lead; optional URLs or storage paths.';

-- ========================================================================
-- FILE: 20260331_growth_engine.sql
-- ========================================================================

-- Growth engine: shareable results, referrals, attribution

create table if not exists public.shareable_results (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'leadsmart',
  tool_slug text not null,
  title text not null,
  summary text,
  result_json jsonb not null default '{}'::jsonb,
  ref_code text,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_shareable_results_brand_created
  on public.shareable_results(brand, created_at desc);

comment on table public.shareable_results is 'Viral share links for calculator/tool outputs; public read by id.';

create table if not exists public.referral_codes (
  code text primary key,
  auth_user_id uuid,
  agent_id bigint,
  label text,
  signups_count int not null default 0,
  conversions_count int not null default 0,
  shares_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_codes_agent on public.referral_codes(agent_id);
create index if not exists idx_referral_codes_user on public.referral_codes(auth_user_id);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.referral_codes(code) on delete cascade,
  event_type text not null check (event_type in ('view','click','signup','conversion','share')),
  auth_user_id uuid,
  page_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_events_code_created on public.referral_events(code, created_at desc);
create index if not exists idx_referral_events_type_created on public.referral_events(event_type, created_at desc);

-- ========================================================================
-- FILE: 20260417_home_value_sessions_tool_events_market_snapshots.sql
-- ========================================================================

-- Home value sessions, tool behavior events, market cache, and CRM lead extensions.
--
-- Notes:
-- - `public.leads` already exists in this project with `id bigint` (CRM). We extend it
--   with LeadSmart AI / home-value columns instead of replacing the table (which would
--   break FKs like leadsmart_runs, communications, etc.).
-- - Some requested indexes (`idx_leads_email`, `idx_leads_city`) may already exist;
--   we use IF NOT EXISTS.
-- - Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper (shared with other tables)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- home_value_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.home_value_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid null references auth.users (id) on delete set null,
  full_address text not null,
  street text null,
  city text not null,
  state text not null,
  zip text not null,
  lat numeric null,
  lng numeric null,

  property_type text null,
  beds numeric null,
  baths numeric null,
  sqft integer null,
  year_built integer null,
  lot_size integer null,
  condition text null,
  renovated_recently boolean null,

  estimate_value numeric null,
  estimate_low numeric null,
  estimate_high numeric null,
  confidence text null,
  confidence_score integer null,
  likely_intent text null,

  source text null default 'propertytoolsai_home_value',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_home_value_sessions_session_id
  on public.home_value_sessions (session_id);

drop trigger if exists trg_home_value_sessions_updated_at on public.home_value_sessions;
create trigger trg_home_value_sessions_updated_at
before update on public.home_value_sessions
for each row
execute function public.set_updated_at();

alter table public.home_value_sessions enable row level security;

comment on table public.home_value_sessions is
  'Home value estimate funnel rows (pre/post lead capture) keyed by client session_id.';

-- ---------------------------------------------------------------------------
-- tool_events
-- ---------------------------------------------------------------------------
create table if not exists public.tool_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid null references auth.users (id) on delete set null,
  tool_name text not null,
  event_name text not null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tool_events_session_id
  on public.tool_events (session_id);

create index if not exists idx_tool_events_tool_event
  on public.tool_events (tool_name, event_name);

alter table public.tool_events enable row level security;

comment on table public.tool_events is
  'Fine-grained tool analytics for scoring and personalization.';

-- ---------------------------------------------------------------------------
-- market_snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  zip text null,
  property_type text null,

  median_ppsf numeric not null,
  median_price numeric null,
  yoy_trend_pct numeric null,
  avg_days_on_market integer null,
  comp_count integer null,

  snapshot_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_market_snapshots_city_zip
  on public.market_snapshots (city, zip);

alter table public.market_snapshots enable row level security;

comment on table public.market_snapshots is
  'Cached local market inputs for the estimate engine.';

-- ---------------------------------------------------------------------------
-- leads (extend existing CRM table)
-- ---------------------------------------------------------------------------
alter table if exists public.leads
  add column if not exists session_id text,
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists full_address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists estimated_value numeric,
  add column if not exists estimate_low numeric,
  add column if not exists estimate_high numeric,
  add column if not exists confidence text,
  add column if not exists confidence_score integer,
  add column if not exists likely_intent text,
  add column if not exists status text not null default 'new',
  add column if not exists assigned_agent_id uuid,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_leads_email
  on public.leads (email);

create index if not exists idx_leads_city
  on public.leads (city);

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

comment on column public.leads.full_address is
  'Normalized full street address (LeadSmart AI / home value); may mirror property_address.';
comment on column public.leads.estimated_value is
  'LeadSmart AI home value point estimate (may mirror property_value / estimated_home_value).';
comment on column public.leads.status is
  'LeadSmart AI pipeline status; existing CRM may also use lead_status.';
comment on column public.leads.assigned_agent_id is
  'Optional agent assignment for LeadSmart AI; may mirror agent_id.';

-- ========================================================================
-- FILE: 20260418_home_value_sessions_session_id_unique.sql
-- ========================================================================

-- One funnel row per client session (enables upsert from /api/home-value-estimate).
create unique index if not exists uq_home_value_sessions_session_id
  on public.home_value_sessions (session_id);

-- ========================================================================
-- FILE: 20260419000000_billing_subscriptions.sql
-- ========================================================================

-- Canonical billing rows; optional link to `public.profiles` (see 20260315000000_create_profiles_table.sql).
-- Requires `public.set_updated_at()` from 20260316000000_profiles_updated_at_trigger.sql.

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete cascade,
  email text not null,
  full_name text null,
  role text not null default 'consumer',

  plan text not null,
  status text not null default 'active',
  amount_monthly numeric not null default 0,

  billing_provider text not null default 'stripe',
  provider_customer_id text null,
  provider_subscription_id text null,
  provider_price_id text null,

  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_subscriptions_user_id
  on public.billing_subscriptions(user_id);

create index if not exists idx_billing_subscriptions_status
  on public.billing_subscriptions(status);

create index if not exists idx_billing_subscriptions_role
  on public.billing_subscriptions(role);

create unique index if not exists idx_billing_provider_subscription
  on public.billing_subscriptions(provider_subscription_id);

create index if not exists idx_billing_provider_customer
  on public.billing_subscriptions(provider_customer_id);

drop trigger if exists trg_billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger trg_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row
execute function public.set_updated_at();

comment on table public.billing_subscriptions is 'Subscription billing snapshot; optional profile link; sync from Stripe or admin tools.';

-- ========================================================================
-- FILE: 20260420000000_billing_subscriptions_upgrade.sql
-- ========================================================================

-- Idempotent upgrade if `20260419000000_billing_subscriptions.sql` was applied before nullable user_id / provider_price_id / new indexes.

alter table if exists public.billing_subscriptions
  alter column user_id drop not null;

alter table if exists public.billing_subscriptions
  add column if not exists provider_price_id text;

alter table if exists public.billing_subscriptions
  alter column role set default 'consumer';

create unique index if not exists idx_billing_provider_subscription
  on public.billing_subscriptions(provider_subscription_id);

create index if not exists idx_billing_provider_customer
  on public.billing_subscriptions(provider_customer_id);

-- ========================================================================
-- FILE: 20260421000000_product_entitlements.sql
-- ========================================================================

-- LeadSmart AI: product entitlements + daily usage (leadsmart_agent)
-- Requires public.set_updated_at() from earlier migrations.

-- ---------------------------------------------------------------------------
-- product_entitlements: denormalized limits per active subscription row
-- ---------------------------------------------------------------------------
create table if not exists public.product_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product text not null,
  plan text not null,
  is_active boolean not null default true,
  cma_reports_per_day int not null default 0,
  max_leads int,
  max_contacts int,
  alerts_level text not null default 'basic',
  reports_download_level text not null default 'limited',
  team_access boolean not null default false,
  source text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_entitlements_product_nonempty check (coalesce(nullif(trim(product), ''), '') <> ''),
  constraint product_entitlements_plan_nonempty check (coalesce(nullif(trim(plan), ''), '') <> '')
);

create index if not exists idx_product_entitlements_user
  on public.product_entitlements (user_id);

create index if not exists idx_product_entitlements_product
  on public.product_entitlements (product);

create unique index if not exists uq_product_entitlements_active_user_product
  on public.product_entitlements (user_id, product)
  where is_active = true;

drop trigger if exists trg_product_entitlements_updated_at on public.product_entitlements;
create trigger trg_product_entitlements_updated_at
before update on public.product_entitlements
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- entitlement_usage_daily: daily counters (user_id → public.profiles)
-- ---------------------------------------------------------------------------
create table if not exists public.entitlement_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product text not null,
  usage_date date not null default current_date,
  cma_reports_used integer not null default 0,
  leads_used integer not null default 0,
  contacts_used integer not null default 0,
  report_downloads_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entitlement_usage_daily_user_id
  on public.entitlement_usage_daily (user_id);

create index if not exists idx_entitlement_usage_daily_product
  on public.entitlement_usage_daily (product);

create unique index if not exists idx_entitlement_usage_daily_unique
  on public.entitlement_usage_daily (user_id, product, usage_date);

drop trigger if exists trg_entitlement_usage_daily_updated_at on public.entitlement_usage_daily;
create trigger trg_entitlement_usage_daily_updated_at
before update on public.entitlement_usage_daily
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPC: atomic daily consume for CMA or report downloads
-- ---------------------------------------------------------------------------
create or replace function public.try_consume_entitlement_daily(
  p_user_id uuid,
  p_product text,
  p_metric text,
  p_amount int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cma_limit int;
  v_reports_level text;
  v_today date := (timezone('utc', now()))::date;
  v_used int := 0;
  v_limit int;
begin
  if p_user_id is null or coalesce(nullif(trim(p_product), ''), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if p_amount is null or p_amount < 1 then
    p_amount := 1;
  end if;

  select
    e.cma_reports_per_day,
    e.reports_download_level
  into v_cma_limit, v_reports_level
  from public.product_entitlements e
  where e.user_id = p_user_id
    and e.product = p_product
    and e.is_active = true
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_active_entitlement');
  end if;

  if p_metric = 'cma_report' then
    v_limit := v_cma_limit;
    if v_limit < 0 then
      v_limit := 1000000;
    end if;
  elsif p_metric = 'report_download' then
    if lower(coalesce(v_reports_level, '')) = 'limited' then
      v_limit := 3;
    elsif lower(coalesce(v_reports_level, '')) in ('full', 'unlimited') then
      v_limit := 1000000;
    else
      v_limit := 0;
    end if;
  else
    return jsonb_build_object('ok', false, 'reason', 'unknown_metric');
  end if;

  insert into public.entitlement_usage_daily (user_id, product, usage_date)
  values (p_user_id, p_product, v_today)
  on conflict (user_id, product, usage_date) do nothing;

  select
    case p_metric
      when 'cma_report' then c.cma_reports_used
      when 'report_download' then c.report_downloads_used
      else 0
    end
  into v_used
  from public.entitlement_usage_daily c
  where c.user_id = p_user_id
    and c.product = p_product
    and c.usage_date = v_today;

  v_used := coalesce(v_used, 0);

  if v_used + p_amount > v_limit then
    return jsonb_build_object(
      'ok', false,
      'reason', 'limit_reached',
      'metric', p_metric,
      'used', v_used,
      'limit', v_limit
    );
  end if;

  if p_metric = 'cma_report' then
    update public.entitlement_usage_daily
    set cma_reports_used = cma_reports_used + p_amount,
        updated_at = now()
    where user_id = p_user_id and product = p_product and usage_date = v_today
    returning cma_reports_used into v_used;
  else
    update public.entitlement_usage_daily
    set report_downloads_used = report_downloads_used + p_amount,
        updated_at = now()
    where user_id = p_user_id and product = p_product and usage_date = v_today
    returning report_downloads_used into v_used;
  end if;

  return jsonb_build_object(
    'ok', true,
    'metric', p_metric,
    'used', v_used,
    'limit', v_limit,
    'usage_date', v_today
  );
end;
$$;

grant execute on function public.try_consume_entitlement_daily(uuid, text, text, int) to authenticated;
grant execute on function public.try_consume_entitlement_daily(uuid, text, text, int) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.product_entitlements enable row level security;
alter table public.entitlement_usage_daily enable row level security;

drop policy if exists "product_entitlements_select_own" on public.product_entitlements;
drop policy if exists "Users can read own entitlements" on public.product_entitlements;
create policy "Users can read own entitlements"
  on public.product_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "product_entitlements_insert_own" on public.product_entitlements;
create policy "product_entitlements_insert_own"
  on public.product_entitlements
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "product_entitlements_update_own" on public.product_entitlements;
create policy "product_entitlements_update_own"
  on public.product_entitlements
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "entitlement_usage_daily_select_own" on public.entitlement_usage_daily;
drop policy if exists "Users can read own usage" on public.entitlement_usage_daily;
create policy "Users can read own usage"
  on public.entitlement_usage_daily
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "entitlement_usage_daily_insert_own" on public.entitlement_usage_daily;
create policy "entitlement_usage_daily_insert_own"
  on public.entitlement_usage_daily
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "entitlement_usage_daily_update_own" on public.entitlement_usage_daily;
create policy "entitlement_usage_daily_update_own"
  on public.entitlement_usage_daily
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.product_entitlements is
  'Commercial entitlements per user+product; limits denormalized from plan.';
comment on table public.entitlement_usage_daily is
  'UTC daily usage buckets for metered features (CMA, downloads, etc.).';

-- ========================================================================
-- FILE: 20260422000000_entitlement_usage_daily_profiles_fk.sql
-- ========================================================================

-- Align entitlement_usage_daily with public.profiles(id) + indexes (idempotent for DBs that applied an older 20260421 shape).

-- 1) Re-point FK from auth.users → profiles (same uuid domain as auth.users)
alter table if exists public.entitlement_usage_daily
  drop constraint if exists entitlement_usage_daily_user_id_fkey;

alter table if exists public.entitlement_usage_daily
  add constraint entitlement_usage_daily_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- 2) usage_date default
alter table if exists public.entitlement_usage_daily
  alter column usage_date set default current_date;

-- 3) Unique: drop legacy constraint name if present, ensure named unique index
alter table if exists public.entitlement_usage_daily
  drop constraint if exists entitlement_usage_daily_unique_day;

drop index if exists public.idx_entitlement_usage_daily_user_product_date;

create unique index if not exists idx_entitlement_usage_daily_unique
  on public.entitlement_usage_daily (user_id, product, usage_date);

create index if not exists idx_entitlement_usage_daily_user_id
  on public.entitlement_usage_daily (user_id);

create index if not exists idx_entitlement_usage_daily_product
  on public.entitlement_usage_daily (product);

-- ========================================================================
-- FILE: 20260423000000_product_entitlements_source.sql
-- ========================================================================

-- Track how an entitlement row was created (manual insert, free start, Stripe, admin, etc.)

alter table public.product_entitlements
  add column if not exists source text;

comment on column public.product_entitlements.source is
  'Origin of the entitlement (e.g. free_start, stripe, admin_grant, migration).';

create index if not exists idx_product_entitlements_source
  on public.product_entitlements (source)
  where source is not null;

-- ========================================================================
-- FILE: 20260424000000_product_entitlements_nullable_lead_contact_caps.sql
-- ========================================================================

-- Elite / unlimited: NULL on max_leads / max_contacts means no cap (same intent as legacy -1 in app).

alter table public.product_entitlements
  alter column max_leads drop not null,
  alter column max_contacts drop not null;

comment on column public.product_entitlements.max_leads is
  'Max leads for the plan; NULL = unlimited.';
comment on column public.product_entitlements.max_contacts is
  'Max CRM contacts for the plan; NULL = unlimited.';

-- ========================================================================
-- FILE: 20260425000000_active_product_entitlements_view.sql
-- ========================================================================

-- Optional subscription window on product_entitlements + convenience view for “currently valid” rows.

alter table public.product_entitlements
  add column if not exists starts_at timestamptz;

alter table public.product_entitlements
  add column if not exists ends_at timestamptz;

comment on column public.product_entitlements.starts_at is
  'Inclusive start of entitlement window; NULL = no lower bound.';
comment on column public.product_entitlements.ends_at is
  'Inclusive end of entitlement window; NULL = no upper bound.';

create index if not exists idx_product_entitlements_starts_at
  on public.product_entitlements (starts_at)
  where starts_at is not null;

create index if not exists idx_product_entitlements_ends_at
  on public.product_entitlements (ends_at)
  where ends_at is not null;

drop view if exists public.active_product_entitlements;

create or replace view public.active_product_entitlements as
select
  id,
  user_id,
  product,
  plan,
  is_active,
  cma_reports_per_day,
  max_leads,
  max_contacts,
  alerts_level,
  reports_download_level,
  team_access,
  starts_at,
  ends_at,
  created_at,
  updated_at
from public.product_entitlements
where is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now());

comment on view public.active_product_entitlements is
  'Rows in product_entitlements that are active and within starts_at/ends_at (if set).';

grant select on public.active_product_entitlements to authenticated;
grant select on public.active_product_entitlements to service_role;

-- ========================================================================
-- FILE: 20260426000000_get_active_agent_entitlement.sql
-- ========================================================================

-- RPC: single active LeadSmart AI Agent entitlement row (uses active_product_entitlements view).

create or replace function public.get_active_agent_entitlement(p_user_id uuid)
returns table (
  entitlement_id uuid,
  user_id uuid,
  product text,
  plan text,
  cma_reports_per_day integer,
  max_leads integer,
  max_contacts integer,
  alerts_level text,
  reports_download_level text,
  team_access boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    e.id,
    e.user_id,
    e.product,
    e.plan,
    e.cma_reports_per_day,
    e.max_leads,
    e.max_contacts,
    e.alerts_level,
    e.reports_download_level,
    e.team_access
  from public.active_product_entitlements e
  where e.user_id = p_user_id
    and e.product = 'leadsmart_agent'
  limit 1;
$$;

comment on function public.get_active_agent_entitlement(uuid) is
  'Returns at most one active leadsmart_agent entitlement for the user (active flag + date window).';

grant execute on function public.get_active_agent_entitlement(uuid) to authenticated;
grant execute on function public.get_active_agent_entitlement(uuid) to service_role;

-- ========================================================================
-- FILE: 20260427000000_ensure_daily_usage_row.sql
-- ========================================================================

-- Ensures a usage row exists for today (session `current_date`) for idempotent daily metering.

create or replace function public.ensure_daily_usage_row(
  p_user_id uuid,
  p_product text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.entitlement_usage_daily (
    user_id,
    product,
    usage_date
  )
  values (
    p_user_id,
    p_product,
    current_date
  )
  on conflict (user_id, product, usage_date) do nothing;
end;
$$;

comment on function public.ensure_daily_usage_row(uuid, text) is
  'Upsert-noop: creates entitlement_usage_daily for (user, product, current_date) if missing.';

grant execute on function public.ensure_daily_usage_row(uuid, text) to authenticated;
grant execute on function public.ensure_daily_usage_row(uuid, text) to service_role;

-- ========================================================================
-- FILE: 20260428000000_increment_cma_usage.sql
-- ========================================================================

-- Increment CMA counter for today after ensuring the daily row exists.

create or replace function public.increment_cma_usage(
  p_user_id uuid,
  p_product text default 'leadsmart_agent'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.ensure_daily_usage_row(p_user_id, p_product);

  update public.entitlement_usage_daily
  set cma_reports_used = cma_reports_used + 1,
      updated_at = now()
  where user_id = p_user_id
    and product = p_product
    and usage_date = current_date;
end;
$$;

comment on function public.increment_cma_usage(uuid, text) is
  'Ensures today’s entitlement_usage_daily row exists, then increments cma_reports_used by 1.';

grant execute on function public.increment_cma_usage(uuid, text) to authenticated;
grant execute on function public.increment_cma_usage(uuid, text) to service_role;

-- ========================================================================
-- FILE: 20260429000000_increment_leads_usage.sql
-- ========================================================================

-- Increment leads_used counter for today after ensuring the daily row exists.

create or replace function public.increment_leads_usage(
  p_user_id uuid,
  p_product text default 'leadsmart_agent'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.ensure_daily_usage_row(p_user_id, p_product);

  update public.entitlement_usage_daily
  set leads_used = leads_used + 1,
      updated_at = now()
  where user_id = p_user_id
    and product = p_product
    and usage_date = current_date;
end;
$$;

comment on function public.increment_leads_usage(uuid, text) is
  'Ensures today’s entitlement_usage_daily row exists, then increments leads_used by 1.';

grant execute on function public.increment_leads_usage(uuid, text) to authenticated;
grant execute on function public.increment_leads_usage(uuid, text) to service_role;

-- ========================================================================
-- FILE: 20260430000000_increment_contacts_usage.sql
-- ========================================================================

-- Increment contacts_used counter for today after ensuring the daily row exists.

create or replace function public.increment_contacts_usage(
  p_user_id uuid,
  p_product text default 'leadsmart_agent'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.ensure_daily_usage_row(p_user_id, p_product);

  update public.entitlement_usage_daily
  set contacts_used = contacts_used + 1,
      updated_at = now()
  where user_id = p_user_id
    and product = p_product
    and usage_date = current_date;
end;
$$;

comment on function public.increment_contacts_usage(uuid, text) is
  'Ensures today’s entitlement_usage_daily row exists, then increments contacts_used by 1.';

grant execute on function public.increment_contacts_usage(uuid, text) to authenticated;
grant execute on function public.increment_contacts_usage(uuid, text) to service_role;

-- ========================================================================
-- FILE: 20260431000000_current_agent_usage_view.sql
-- ========================================================================

-- All daily usage rows for LeadSmart AI Agent (any date).

create or replace view public.current_agent_usage as
select
  u.user_id,
  u.product,
  u.usage_date,
  u.cma_reports_used,
  u.leads_used,
  u.contacts_used,
  u.report_downloads_used
from public.entitlement_usage_daily u
where u.product = 'leadsmart_agent';

comment on view public.current_agent_usage is
  'Metering snapshots from entitlement_usage_daily for product leadsmart_agent.';

grant select on public.current_agent_usage to authenticated;
grant select on public.current_agent_usage to service_role;

-- ========================================================================
-- FILE: 20260432000000_ensure_rls_entitlement_tables.sql
-- ========================================================================

-- Idempotent: ensure RLS is enabled (safe if already on from 20260421000000_product_entitlements.sql).

alter table if exists public.product_entitlements enable row level security;
alter table if exists public.entitlement_usage_daily enable row level security;

-- ========================================================================
-- FILE: 20260433000000_product_entitlements_select_policy_label.sql
-- ========================================================================

-- Human-readable SELECT policy name (same rule as product_entitlements_select_own).

drop policy if exists "product_entitlements_select_own" on public.product_entitlements;
drop policy if exists "Users can read own entitlements" on public.product_entitlements;

create policy "Users can read own entitlements"
  on public.product_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ========================================================================
-- FILE: 20260434000000_entitlement_usage_daily_select_policy_label.sql
-- ========================================================================

-- Human-readable SELECT policy name (same rule as entitlement_usage_daily_select_own).

drop policy if exists "entitlement_usage_daily_select_own" on public.entitlement_usage_daily;
drop policy if exists "Users can read own usage" on public.entitlement_usage_daily;

create policy "Users can read own usage"
  on public.entitlement_usage_daily
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ========================================================================
-- FILE: 20260452000000_warehouse_zip_comp_candidate_ids.sql
-- ========================================================================

-- Pre-filter ZIP neighbors to properties that have at least one snapshot with a positive sale price.
-- properties_warehouse has no sold_price column; sale amounts live on property_snapshots_warehouse.

create or replace function public.warehouse_property_ids_in_zip_with_sale_price(
  p_zip text,
  p_exclude_property_id uuid,
  p_max integer default 400
)
returns uuid[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    array_agg(sub.id order by sub.id),
    array[]::uuid[]
  )
  from (
    select distinct p.id
    from public.properties_warehouse p
    inner join public.property_snapshots_warehouse s on s.property_id = p.id
    where p.id <> p_exclude_property_id
      and (
        (p_zip is null and p.zip_code is null)
        or (p_zip is not null and p.zip_code = p_zip)
      )
      and s.estimated_value is not null
      and s.estimated_value > 0
      and (
        lower(trim(coalesce(s.listing_status, ''))) in ('sold', 'closed', 'off_market_sold')
        or nullif(trim(coalesce(s.data ->> 'sale_date', '')), '') is not null
        or nullif(trim(coalesce(s.data ->> 'saleDate', '')), '') is not null
      )
    limit greatest(1, least(coalesce(p_max, 400), 2000))
  ) sub;
$$;

revoke all on function public.warehouse_property_ids_in_zip_with_sale_price(text, uuid, integer) from public;
grant execute on function public.warehouse_property_ids_in_zip_with_sale_price(text, uuid, integer) to authenticated, service_role;

-- ========================================================================
-- FILE: 20260453000000_sms_messages_twilio_delivery.sql
-- ========================================================================

-- Twilio delivery tracking on CRM SMS rows (status callbacks).

alter table if exists public.sms_messages
  add column if not exists external_message_id text null,
  add column if not exists twilio_status text null,
  add column if not exists delivery_error_code text null,
  add column if not exists delivery_error_message text null;

create index if not exists idx_sms_messages_external_message_id
  on public.sms_messages(external_message_id)
  where external_message_id is not null;

-- ========================================================================
-- FILE: 20260453100000_email_messages.sql
-- ========================================================================

-- CRM email thread rows for AI + agent outbound (separate from nurture message_logs).

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  agent_id uuid,
  subject text not null default '',
  message text not null,
  direction text not null,
  created_at timestamptz not null default now(),
  external_message_id text null,
  constraint email_messages_direction_check check (direction in ('inbound', 'outbound'))
);

create index if not exists idx_email_messages_lead_created
  on public.email_messages(lead_id, created_at desc);

create index if not exists idx_email_messages_agent_created
  on public.email_messages(agent_id, created_at desc);

-- ========================================================================
-- FILE: 20260453200000_greeting_automation.sql
-- ========================================================================

-- Greeting automation: lead fields + per-agent settings + send history.
-- agent_id types follow public.agents.id (uuid or bigint).

alter table if exists public.leads
  add column if not exists birthday date null,
  add column if not exists home_purchase_date date null,
  add column if not exists preferred_contact_channel text null,
  add column if not exists contact_opt_out_sms boolean not null default false,
  add column if not exists contact_opt_out_email boolean not null default false,
  add column if not exists relationship_stage text null,
  add column if not exists lead_tags_json jsonb not null default '[]'::jsonb;

comment on column public.leads.preferred_contact_channel is 'sms | email | both — used by smart greeting routing';
comment on column public.leads.lead_tags_json is 'Arbitrary string tags for segmentation (JSON array of strings).';

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
      create table if not exists public.greeting_automation_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        birthday_enabled boolean not null default true,
        holiday_enabled boolean not null default true,
        home_anniversary_enabled boolean not null default true,
        checkin_enabled boolean not null default false,
        preferred_channel text not null default 'smart'
          check (preferred_channel in ('sms', 'email', 'smart')),
        tone text not null default 'friendly'
          check (tone in ('friendly', 'professional', 'luxury')),
        send_hour_local integer not null default 9
          check (send_hour_local >= 0 and send_hour_local <= 23),
        use_ai_personalization boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.greeting_automation_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        birthday_enabled boolean not null default true,
        holiday_enabled boolean not null default true,
        home_anniversary_enabled boolean not null default true,
        checkin_enabled boolean not null default false,
        preferred_channel text not null default 'smart'
          check (preferred_channel in ('sms', 'email', 'smart')),
        tone text not null default 'friendly'
          check (tone in ('friendly', 'professional', 'luxury')),
        send_hour_local integer not null default 9
          check (send_hour_local >= 0 and send_hour_local <= 23),
        use_ai_personalization boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for greeting_automation_settings: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_greeting_automation_settings_agent
  on public.greeting_automation_settings(agent_id);

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

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.greeting_message_history (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id uuid null references public.agents(id) on delete set null,
        event_type text not null
          check (event_type in ('birthday', 'holiday', 'home_anniversary', 'checkin')),
        holiday_key text null,
        channel text not null check (channel in ('sms', 'email')),
        subject text null,
        body text not null,
        status text not null default 'queued'
          check (status in ('queued', 'sent', 'failed', 'skipped')),
        scheduled_for timestamptz null,
        sent_at timestamptz null,
        skipped_reason text null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.greeting_message_history (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id bigint null references public.agents(id) on delete set null,
        event_type text not null
          check (event_type in ('birthday', 'holiday', 'home_anniversary', 'checkin')),
        holiday_key text null,
        channel text not null check (channel in ('sms', 'email')),
        subject text null,
        body text not null,
        status text not null default 'queued'
          check (status in ('queued', 'sent', 'failed', 'skipped')),
        scheduled_for timestamptz null,
        sent_at timestamptz null,
        skipped_reason text null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for greeting_message_history: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_greeting_history_lead_created
  on public.greeting_message_history(lead_id, created_at desc);

create index if not exists idx_greeting_history_event_created
  on public.greeting_message_history(event_type, created_at desc);

-- ========================================================================
-- FILE: 20260453300000_contact_cleanup_enrichment.sql
-- ========================================================================

-- Contact cleanup, normalization, duplicate tracking, and enrichment runs.
-- Lead IDs are bigint in this project.

alter table if exists public.leads
  add column if not exists normalized_email text null,
  add column if not exists normalized_phone text null,
  add column if not exists normalized_address text null,
  add column if not exists contact_completeness_score integer not null default 0,
  add column if not exists enrichment_status text null,
  add column if not exists inferred_contact_type text null,
  add column if not exists inferred_lifecycle_stage text null,
  add column if not exists preferred_contact_time text null,
  add column if not exists mailing_address text null,
  add column if not exists merged_into_lead_id bigint null references public.leads(id) on delete set null,
  add column if not exists duplicate_group_key text null,
  add column if not exists notes_summary text null;

comment on column public.leads.merged_into_lead_id is 'When set, this row is archived as a duplicate of the referenced lead.';
comment on column public.leads.duplicate_group_key is 'Optional stable key for grouping related duplicates (e.g. hash of email+phone).';

create table if not exists public.lead_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  primary_lead_id bigint not null references public.leads(id) on delete cascade,
  duplicate_lead_id bigint not null references public.leads(id) on delete cascade,
  confidence_score integer not null,
  reason_json jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'merged', 'ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (primary_lead_id, duplicate_lead_id),
  check (primary_lead_id <> duplicate_lead_id)
);

create table if not exists public.lead_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  run_type text not null
    check (run_type in ('cleanup', 'enrichment', 'merge')),
  status text not null default 'completed',
  changes_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_normalized_email on public.leads(normalized_email);
create index if not exists idx_leads_normalized_phone on public.leads(normalized_phone);
create index if not exists idx_leads_duplicate_group_key on public.leads(duplicate_group_key);
create index if not exists idx_leads_merged_into on public.leads(merged_into_lead_id)
  where merged_into_lead_id is not null;

create index if not exists idx_duplicate_candidates_status
  on public.lead_duplicate_candidates(status, confidence_score desc);

create index if not exists idx_lead_enrichment_runs_lead
  on public.lead_enrichment_runs(lead_id, created_at desc);

-- ========================================================================
-- FILE: 20260453400000_reengagement_campaigns.sql
-- ========================================================================

-- Re-engagement campaigns: per-agent sequences + send logs.
-- agent_id follows public.agents.id (uuid or bigint). lead_id is bigint.

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
      create table if not exists public.reengagement_campaigns (
        id uuid primary key default gen_random_uuid(),
        name text,
        agent_id uuid not null references public.agents(id) on delete cascade,
        status text not null default 'active'
          check (status in ('active', 'paused', 'archived')),
        channel text not null default 'sms'
          check (channel in ('sms', 'email')),
        trigger_type text not null default 'cold_lead'
          check (trigger_type in ('cold_lead', 'no_activity', 'anniversary', 'custom')),
        days_inactive integer not null default 30
          check (days_inactive >= 1 and days_inactive <= 730),
        max_per_run integer not null default 25
          check (max_per_run >= 1 and max_per_run <= 500),
        use_ai boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.reengagement_campaigns (
        id uuid primary key default gen_random_uuid(),
        name text,
        agent_id bigint not null references public.agents(id) on delete cascade,
        status text not null default 'active'
          check (status in ('active', 'paused', 'archived')),
        channel text not null default 'sms'
          check (channel in ('sms', 'email')),
        trigger_type text not null default 'cold_lead'
          check (trigger_type in ('cold_lead', 'no_activity', 'anniversary', 'custom')),
        days_inactive integer not null default 30
          check (days_inactive >= 1 and days_inactive <= 730),
        max_per_run integer not null default 25
          check (max_per_run >= 1 and max_per_run <= 500),
        use_ai boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for reengagement_campaigns: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_reengagement_campaigns_agent_status
  on public.reengagement_campaigns(agent_id, status);

create table if not exists public.reengagement_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.reengagement_campaigns(id) on delete cascade,
  step_number integer not null check (step_number >= 0),
  delay_days integer not null default 0
    check (delay_days >= 0 and delay_days <= 365),
  step_type text not null default 'nudge'
    check (step_type in ('initial', 'nudge', 'last_attempt', 'custom')),
  template text,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_number)
);

comment on column public.reengagement_messages.delay_days is
  'Days after the first step (step 0) send when this step is due. E.g. 0, 2, 5 for a 3-touch sequence.';

create index if not exists idx_reengagement_messages_campaign
  on public.reengagement_messages(campaign_id, step_number);

create table if not exists public.reengagement_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.reengagement_campaigns(id) on delete cascade,
  step_number integer not null,
  channel text not null check (channel in ('sms', 'email')),
  status text not null default 'sent'
    check (status in ('sent', 'skipped', 'failed')),
  body text not null default '',
  response text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_reengagement_logs_lead_campaign
  on public.reengagement_logs(lead_id, campaign_id, created_at desc);

create index if not exists idx_reengagement_logs_campaign_created
  on public.reengagement_logs(campaign_id, created_at desc);

-- ========================================================================
-- FILE: 20260453500000_mobile_push_tokens.sql
-- ========================================================================

-- Mobile Expo push token registry (user + optional agent scope).

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id bigint null references public.agents (id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'unknown'
    check (platform in ('ios', 'android', 'web', 'unknown')),
  device_id text null,
  app_version text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists idx_mobile_push_tokens_user_id
  on public.mobile_push_tokens (user_id, updated_at desc);

create index if not exists idx_mobile_push_tokens_agent_id
  on public.mobile_push_tokens (agent_id)
  where agent_id is not null;

comment on table public.mobile_push_tokens is 'Expo push tokens for LeadSmart mobile; updated via /api/mobile/push/register.';

-- ========================================================================
-- FILE: 20260453600000_crm_pipeline_tasks.sql
-- ========================================================================

-- Deal pipeline stages + tasks (per agent). Optional lead.pipeline_stage_id for board views.

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
      create table if not exists public.crm_pipeline_stages (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        name text not null,
        slug text not null,
        position integer not null default 0,
        color text null,
        created_at timestamptz not null default now(),
        unique (agent_id, slug)
      )
    $sql$;
    execute $sql$
      create table if not exists public.crm_tasks (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        lead_id bigint null references public.leads(id) on delete set null,
        pipeline_stage_id uuid null references public.crm_pipeline_stages(id) on delete set null,
        title text not null,
        description text null,
        status text not null default 'open'
          check (status in ('open', 'done', 'cancelled')),
        priority text not null default 'normal'
          check (priority in ('low', 'normal', 'high', 'urgent')),
        due_at timestamptz null,
        completed_at timestamptz null,
        source text not null default 'agent'
          check (source in ('agent', 'ai', 'system', 'automation')),
        ai_rationale text null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.crm_pipeline_stages (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        name text not null,
        slug text not null,
        position integer not null default 0,
        color text null,
        created_at timestamptz not null default now(),
        unique (agent_id, slug)
      )
    $sql$;
    execute $sql$
      create table if not exists public.crm_tasks (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        lead_id bigint null references public.leads(id) on delete set null,
        pipeline_stage_id uuid null references public.crm_pipeline_stages(id) on delete set null,
        title text not null,
        description text null,
        status text not null default 'open'
          check (status in ('open', 'done', 'cancelled')),
        priority text not null default 'normal'
          check (priority in ('low', 'normal', 'high', 'urgent')),
        due_at timestamptz null,
        completed_at timestamptz null,
        source text not null default 'agent'
          check (source in ('agent', 'ai', 'system', 'automation')),
        ai_rationale text null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for crm_pipeline_stages: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_crm_pipeline_stages_agent_position
  on public.crm_pipeline_stages(agent_id, position);

create index if not exists idx_crm_tasks_agent_status_updated
  on public.crm_tasks(agent_id, status, updated_at desc);

create index if not exists idx_crm_tasks_lead_id
  on public.crm_tasks(lead_id)
  where lead_id is not null;

alter table if exists public.leads
  add column if not exists pipeline_stage_id uuid null references public.crm_pipeline_stages(id) on delete set null;

create index if not exists idx_leads_pipeline_stage_id
  on public.leads(pipeline_stage_id)
  where pipeline_stage_id is not null;

comment on table public.crm_pipeline_stages is 'Per-agent deal pipeline columns (buyer/seller workflow).';
comment on table public.crm_tasks is 'Tasks and follow-ups; may link to a lead and optional pipeline stage context.';
comment on column public.leads.pipeline_stage_id is 'Current deal stage for board/Kanban views.';

-- ========================================================================
-- FILE: 20260460000000_mobile_message_realtime_rls.sql
-- ========================================================================

-- RLS + realtime for LeadSmart mobile: agents read message rows only for their leads.
-- Service role (server) bypasses RLS. Authenticated users (JWT) use policies below.

alter table if exists public.sms_messages enable row level security;
alter table if exists public.email_messages enable row level security;
alter table if exists public.sms_conversations enable row level security;

drop policy if exists "sms_messages_select_own_agent_leads" on public.sms_messages;
create policy "sms_messages_select_own_agent_leads"
  on public.sms_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      inner join public.agents a on a.id = l.agent_id
      where l.id = sms_messages.lead_id
        and a.auth_user_id = auth.uid()
    )
  );

drop policy if exists "email_messages_select_own_agent_leads" on public.email_messages;
create policy "email_messages_select_own_agent_leads"
  on public.email_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      inner join public.agents a on a.id = l.agent_id
      where l.id = email_messages.lead_id
        and a.auth_user_id = auth.uid()
    )
  );

drop policy if exists "sms_conversations_select_own_agent_leads" on public.sms_conversations;
create policy "sms_conversations_select_own_agent_leads"
  on public.sms_conversations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      inner join public.agents a on a.id = l.agent_id
      where l.id = sms_conversations.lead_id
        and a.auth_user_id = auth.uid()
    )
  );

-- Broadcast changes to authenticated subscribers (RLS filters events per user).
do $$
begin
  alter publication supabase_realtime add table public.sms_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.email_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.sms_conversations;
exception
  when duplicate_object then null;
end $$;

-- ========================================================================
-- FILE: 20260461000000_deal_prediction_engine.sql
-- ========================================================================

-- Deal prediction: 3–6 month buy/sell likelihood (rules-based, explainable factors in JSON).
-- Distinct from `lead_scores` (AI intent/timeline) and `leads.score` (marketplace rules).

alter table if exists public.leads
  add column if not exists prediction_score smallint,
  add column if not exists prediction_label text,
  add column if not exists prediction_factors jsonb not null default '[]'::jsonb,
  add column if not exists prediction_computed_at timestamptz;

comment on column public.leads.prediction_score is '0–100 deal likelihood in next ~3–6 months (rules engine; see prediction_factors).';
comment on column public.leads.prediction_label is 'low | medium | high — derived from prediction_score thresholds.';
comment on column public.leads.prediction_factors is 'Explainable breakdown: array of { id, label, pointsEarned, pointsMax, detail }.';
comment on column public.leads.prediction_computed_at is 'When prediction_score was last computed.';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'leads' and c.conname = 'leads_prediction_score_range'
  ) then
    alter table public.leads
      add constraint leads_prediction_score_range
      check (prediction_score is null or (prediction_score >= 0 and prediction_score <= 100));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'leads' and c.conname = 'leads_prediction_label_enum'
  ) then
    alter table public.leads
      add constraint leads_prediction_label_enum
      check (
        prediction_label is null
        or prediction_label in ('low', 'medium', 'high')
      );
  end if;
end $$;

create index if not exists idx_leads_agent_prediction_score
  on public.leads(agent_id, prediction_score desc nulls last)
  where merged_into_lead_id is null;

create index if not exists idx_leads_prediction_computed_at
  on public.leads(prediction_computed_at desc nulls last)
  where merged_into_lead_id is null;

-- ========================================================================
-- FILE: 20260462000000_lead_tasks.sql
-- ========================================================================

-- Per-lead tasks (distinct from crm_tasks pipeline rows).
-- `public.leads.id` is bigint in this project — not uuid.

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
      create table if not exists public.lead_tasks (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        assigned_agent_id uuid null references public.agents(id) on delete set null,
        title text not null,
        description text null,
        due_at timestamptz null,
        status text not null default 'open',
        priority text not null default 'medium',
        task_type text null,
        created_by text null default 'system',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.lead_tasks (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        assigned_agent_id bigint null references public.agents(id) on delete set null,
        title text not null,
        description text null,
        due_at timestamptz null,
        status text not null default 'open',
        priority text not null default 'medium',
        task_type text null,
        created_by text null default 'system',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for lead_tasks: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_lead_tasks_lead_id on public.lead_tasks(lead_id);
create index if not exists idx_lead_tasks_assigned_agent on public.lead_tasks(assigned_agent_id);
create index if not exists idx_lead_tasks_due_at on public.lead_tasks(due_at);
create index if not exists idx_lead_tasks_status on public.lead_tasks(status);

comment on table public.lead_tasks is 'Tasks attached to a lead; assigned_agent_id optional.';

-- ========================================================================
-- FILE: 20260463000000_lead_tasks_completion_meta.sql
-- ========================================================================

-- lead_tasks: completion timestamp + optional metadata for automation / future AI tasks.

alter table if exists public.lead_tasks
  add column if not exists completed_at timestamptz null,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

comment on column public.lead_tasks.completed_at is 'Set when status becomes done.';
comment on column public.lead_tasks.metadata_json is 'Opaque payload (e.g. AI task provenance).';

create index if not exists idx_lead_tasks_open_due
  on public.lead_tasks(lead_id, due_at)
  where status = 'open';

-- ========================================================================
-- FILE: 20260464000000_lead_calendar_booking.sql
-- ========================================================================

-- Mobile calendar appointments + booking links (Google-first; Outlook-ready via calendar_provider + external ids).

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
      create table if not exists public.lead_calendar_events (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id uuid not null references public.agents(id) on delete cascade,
        title text not null,
        description text null,
        starts_at timestamptz not null,
        ends_at timestamptz null,
        timezone text null,
        status text not null default 'scheduled',
        calendar_provider text null,
        external_event_id text null,
        external_calendar_id text null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
    execute $sql$
      create table if not exists public.lead_booking_links (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id uuid not null references public.agents(id) on delete cascade,
        booking_url text not null,
        label text null,
        share_message text null,
        expires_at timestamptz null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.lead_calendar_events (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id bigint not null references public.agents(id) on delete cascade,
        title text not null,
        description text null,
        starts_at timestamptz not null,
        ends_at timestamptz null,
        timezone text null,
        status text not null default 'scheduled',
        calendar_provider text null,
        external_event_id text null,
        external_calendar_id text null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
    execute $sql$
      create table if not exists public.lead_booking_links (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id bigint not null references public.agents(id) on delete cascade,
        booking_url text not null,
        label text null,
        share_message text null,
        expires_at timestamptz null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for lead_calendar_events: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_lead_calendar_events_agent_starts
  on public.lead_calendar_events(agent_id, starts_at asc)
  where status = 'scheduled';

create index if not exists idx_lead_calendar_events_lead_id
  on public.lead_calendar_events(lead_id, starts_at asc);

create index if not exists idx_lead_booking_links_lead_created
  on public.lead_booking_links(lead_id, created_at desc);

create index if not exists idx_lead_booking_links_agent_created
  on public.lead_booking_links(agent_id, created_at desc);

comment on table public.lead_calendar_events is 'Per-lead appointments; sync fields reserved for Google/Outlook.';
comment on table public.lead_booking_links is 'Scheduling URLs shared with leads; ties to CRM via lead_id + last_activity_at bumps.';

-- ========================================================================
-- FILE: 20260465100000_subscriptions.sql
-- ========================================================================

-- Stripe-oriented subscription snapshot (narrow table). See also `public.billing_subscriptions`.
-- Requires `public.set_updated_at()` from 20260316000000_profiles_updated_at_trigger.sql.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);

create index if not exists idx_subscriptions_status on public.subscriptions (status);

create unique index if not exists idx_subscriptions_stripe_subscription_id
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;

create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

comment on table public.subscriptions is
  'Per-user Stripe subscription row; sync from webhooks or checkout.';

-- ========================================================================
-- FILE: 20260466000000_leadsmart_funnel.sql
-- ========================================================================

-- Activation funnel + AI usage (UTC month) for free/starter tiers.
-- Requires public.profiles(id) (auth users).

create table if not exists public.leadsmart_funnel_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  onboarding_completed_at timestamptz,
  first_reply_at timestamptz,
  first_ai_usage_at timestamptz,
  /** First day of the UTC month for `ai_usage_count`. */
  ai_usage_month date,
  ai_usage_count int not null default 0,
  last_upgrade_prompt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_leadsmart_funnel_state_updated_at on public.leadsmart_funnel_state;
create trigger trg_leadsmart_funnel_state_updated_at
before update on public.leadsmart_funnel_state
for each row execute function public.set_updated_at();

create index if not exists idx_leadsmart_funnel_onboarding
  on public.leadsmart_funnel_state (onboarding_completed_at)
  where onboarding_completed_at is not null;

comment on table public.leadsmart_funnel_state is
  'Per-user activation milestones and monthly AI draft usage (free/starter caps).';

create table if not exists public.leadsmart_funnel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leadsmart_funnel_events_user_type
  on public.leadsmart_funnel_events (user_id, event_type, created_at desc);

create index if not exists idx_leadsmart_funnel_events_type_created
  on public.leadsmart_funnel_events (event_type, created_at desc);

comment on table public.leadsmart_funnel_events is
  'Append-only funnel analytics (onboarding, activation, upgrade intent, conversion).';

/**
 * Atomically consume one AI credit when `p_monthly_limit` is finite (>0 and < 999999).
 * Unlimited: marks first_ai_usage_at, does not increment counter.
 */
create or replace function public.leadsmart_try_consume_ai_credit(p_user_id uuid, p_monthly_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := (date_trunc('month', timezone('utc', now())))::date;
  rec public.leadsmart_funnel_state%rowtype;
  v_next int;
begin
  insert into public.leadsmart_funnel_state (user_id, ai_usage_month, ai_usage_count, updated_at)
  values (p_user_id, v_month, 0, now())
  on conflict (user_id) do nothing;

  select * into rec from public.leadsmart_funnel_state where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('allowed', false, 'error', 'no_row');
  end if;

  if rec.ai_usage_month is distinct from v_month then
    update public.leadsmart_funnel_state
    set ai_usage_month = v_month, ai_usage_count = 0, updated_at = now()
    where user_id = p_user_id;
    rec.ai_usage_month := v_month;
    rec.ai_usage_count := 0;
  end if;

  if p_monthly_limit <= 0 or p_monthly_limit >= 999999 then
    update public.leadsmart_funnel_state
    set
      first_ai_usage_at = coalesce(first_ai_usage_at, now()),
      updated_at = now()
    where user_id = p_user_id;
    return jsonb_build_object('allowed', true, 'unlimited', true);
  end if;

  if rec.ai_usage_count >= p_monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'count', rec.ai_usage_count,
      'limit', p_monthly_limit
    );
  end if;

  v_next := rec.ai_usage_count + 1;
  update public.leadsmart_funnel_state
  set
    ai_usage_count = v_next,
    first_ai_usage_at = coalesce(first_ai_usage_at, now()),
    updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object('allowed', true, 'count', v_next, 'limit', p_monthly_limit);
end;
$$;

-- ========================================================================
-- FILE: 20260467000000_usage_events.sql
-- ========================================================================

-- Generic usage / analytics events (append-only).
-- `user_id` nullable for system or pre-auth events.

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_user_created
  on public.usage_events (user_id, created_at desc);

create index if not exists idx_usage_events_type_created
  on public.usage_events (event_type, created_at desc);

comment on table public.usage_events is
  'Append-only usage or product events; optional link to profiles when user is known.';

-- ========================================================================
-- FILE: 20260468000000_subscription_events.sql
-- ========================================================================

-- Append-only subscription lifecycle / billing events (Stripe sync, upgrades, etc.).

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  plan text,
  amount numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_events_user_created
  on public.subscription_events (user_id, created_at desc);

create index if not exists idx_subscription_events_type_created
  on public.subscription_events (event_type, created_at desc);

comment on table public.subscription_events is
  'Audit trail for subscription changes and charges; optional user when known.';

-- ========================================================================
-- FILE: 20260469000000_subscription_events_stripe_ref.sql
-- ========================================================================

-- Optional Stripe subscription id + metadata for MRR time-series reconstruction and tooling.

alter table public.subscription_events
  add column if not exists stripe_subscription_id text null;

alter table public.subscription_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_subscription_events_stripe_created
  on public.subscription_events (stripe_subscription_id, created_at desc);

comment on column public.subscription_events.stripe_subscription_id is
  'Stripe subscription id when the event relates to a specific subscription row.';

-- ========================================================================
-- FILE: 20260470000000_contact_import_jobs.sql
-- ========================================================================

-- CSV / business-card import jobs and per-row staging for LeadSmart AI contact intake.
-- agent_id follows public.agents.id (uuid or bigint).

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
      create table if not exists public.contact_import_jobs (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents (id) on delete cascade,
        created_by uuid null,
        intake_channel text not null
          check (intake_channel in ('csv', 'business_card', 'manual_batch')),
        status text not null default 'draft'
          check (status in ('draft', 'mapping', 'preview', 'processing', 'completed', 'failed', 'cancelled')),
        file_name text null,
        column_mapping jsonb not null default '{}'::jsonb,
        duplicate_strategy text null
          check (duplicate_strategy is null or duplicate_strategy in ('skip', 'merge', 'create_anyway')),
        summary jsonb not null default '{}'::jsonb,
        error_message text null,
        scan_draft jsonb null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.contact_import_jobs (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents (id) on delete cascade,
        created_by uuid null,
        intake_channel text not null
          check (intake_channel in ('csv', 'business_card', 'manual_batch')),
        status text not null default 'draft'
          check (status in ('draft', 'mapping', 'preview', 'processing', 'completed', 'failed', 'cancelled')),
        file_name text null,
        column_mapping jsonb not null default '{}'::jsonb,
        duplicate_strategy text null
          check (duplicate_strategy is null or duplicate_strategy in ('skip', 'merge', 'create_anyway')),
        summary jsonb not null default '{}'::jsonb,
        error_message text null,
        scan_draft jsonb null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for contact_import_jobs: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_contact_import_jobs_agent_created
  on public.contact_import_jobs (agent_id, created_at desc);

create index if not exists idx_contact_import_jobs_status
  on public.contact_import_jobs (status, updated_at desc);

comment on table public.contact_import_jobs is
  'Import batches (CSV, business card review, optional manual batch); rows staged in contact_import_rows.';
comment on column public.contact_import_jobs.scan_draft is
  'For business card: OCR payload + parser output until user confirms (never auto-saves to CRM).';

create table if not exists public.contact_import_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.contact_import_jobs (id) on delete cascade,
  row_index int not null,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb null,
  duplicate_lead_id bigint null references public.leads (id) on delete set null,
  duplicate_confidence int null,
  resolution text not null default 'pending'
    check (resolution in ('pending', 'inserted', 'skipped', 'merged', 'error')),
  lead_id bigint null references public.leads (id) on delete set null,
  error_message text null,
  created_at timestamptz not null default now(),
  unique (job_id, row_index)
);

create index if not exists idx_contact_import_rows_job
  on public.contact_import_rows (job_id, row_index);

create index if not exists idx_contact_import_rows_duplicate
  on public.contact_import_rows (duplicate_lead_id)
  where duplicate_lead_id is not null;

comment on table public.contact_import_rows is
  'Staged CSV rows or parsed card fields; normalized + duplicate hints before finalize.';

drop trigger if exists trg_contact_import_jobs_updated_at on public.contact_import_jobs;
create trigger trg_contact_import_jobs_updated_at
before update on public.contact_import_jobs
for each row execute function public.set_updated_at();

alter table public.leads
  add column if not exists intake_channel text null;
alter table public.leads
  add column if not exists import_job_id uuid null references public.contact_import_jobs (id) on delete set null;

comment on column public.leads.intake_channel is
  'manual | csv_import | business_card — complements `source` (campaign/tool).';
comment on column public.leads.import_job_id is
  'Set when the lead was created from a contact import job.';


-- ========================================================================
-- APPENDED: migrations 20260471000000 → 20260531000000
-- (all migrations added after the original consolidated_all_migrations.sql)
-- ========================================================================


-- FILE: 20260471000000_public_events_product_analytics.sql

-- Product / funnel analytics (lead_scored, price_assigned, etc.) — used by lib/leadScorePipeline.ts
-- Mirrors apps/propertytoolsai/supabase/migrations/20260315_product_events_and_lead_intent.sql (events table only).

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_event_type_created_at
  on public.events (event_type, created_at desc);

create index if not exists idx_events_user_id_created_at
  on public.events (user_id, created_at desc);

comment on table public.events is 'Product / funnel analytics (tool_used, lead_submitted, lead_scored, etc.)';

alter table public.events enable row level security;


-- FILE: 20260471200000_lead_events_agent_id_agents_pk.sql

-- Align `lead_events.agent_id` with `public.agents(id)` (same as `leads.agent_id` on bigint schemas).
-- Previously `lead_events.agent_id` was uuid while CRM uses agents PK as bigint.
--
-- 1) If agent_id is uuid and agents.id is bigint: map via agents.auth_user_id, then bigint + FK.
-- 2) When `leads.agent_id` is bigint, refresh `log_lead_event` to copy it into `lead_events`.

do $$
declare
  v_le_agent text;
  v_ag_id text;
begin
  select a.atttypid::regtype::text
    into v_le_agent
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'lead_events'
    and a.attname = 'agent_id'
    and a.attnum > 0
    and not a.attisdropped;

  select a.atttypid::regtype::text
    into v_ag_id
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if v_le_agent is null or v_ag_id is null then
    return;
  end if;

  if v_le_agent in ('bigint', 'int8') and v_ag_id in ('bigint', 'int8') then
    return;
  end if;

  if v_le_agent = 'uuid' and v_ag_id in ('bigint', 'int8') then
    drop index if exists public.idx_lead_events_agent_id_created_at;

    alter table public.lead_events
      drop constraint if exists lead_events_agent_id_fkey;

    alter table public.lead_events
      add column if not exists _agent_pk_migrate bigint;

    update public.lead_events le
    set _agent_pk_migrate = a.id
    from public.agents a
    where le.agent_id is not null
      and a.auth_user_id = le.agent_id;

    alter table public.lead_events
      drop column if exists agent_id;

    alter table public.lead_events
      rename column _agent_pk_migrate to agent_id;

    create index if not exists idx_lead_events_agent_id_created_at
      on public.lead_events(agent_id, created_at desc);

    alter table public.lead_events
      add constraint lead_events_agent_id_fkey
      foreign key (agent_id) references public.agents(id) on delete set null;
  end if;
end $$;

do $install_log_fn$
declare
  v_leads_agent text;
  v_le_events_agent text;
begin
  select a.atttypid::regtype::text
    into v_leads_agent
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'leads'
    and a.attname = 'agent_id'
    and a.attnum > 0
    and not a.attisdropped;

  select a.atttypid::regtype::text
    into v_le_events_agent
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'lead_events'
    and a.attname = 'agent_id'
    and a.attnum > 0
    and not a.attisdropped;

  if v_leads_agent not in ('bigint', 'int8')
     or v_le_events_agent not in ('bigint', 'int8') then
    return;
  end if;

  execute $fn$
create or replace function public.log_lead_event(
  p_lead_id bigint,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
as $body$
declare
  v_agent_id bigint;
  v_score_delta int := 0;
  v_window interval := interval '0 minutes';
  v_now timestamptz := now();
  v_last_event timestamptz;
  v_new_score int;
begin
  if p_lead_id is null or coalesce(nullif(trim(p_event_type), ''), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Invalid input');
  end if;

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

  select agent_id into v_agent_id
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Lead not found');
  end if;

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
$body$;
$fn$;
end
$install_log_fn$;

comment on column public.lead_events.agent_id is 'FK to public.agents(id) — same as leads.agent_id (agents PK).';


-- FILE: 20260471300000_communications_agent_id_agents_pk.sql

-- Align `communications.agent_id` with `public.agents(id)` (same as `leads.agent_id` on bigint schemas).

do $$
declare
  v_comm_agent text;
  v_ag_id text;
begin
  select a.atttypid::regtype::text
    into v_comm_agent
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'communications'
    and a.attname = 'agent_id'
    and a.attnum > 0
    and not a.attisdropped;

  select a.atttypid::regtype::text
    into v_ag_id
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if v_comm_agent is null or v_ag_id is null then
    return;
  end if;

  if v_comm_agent in ('bigint', 'int8') and v_ag_id in ('bigint', 'int8') then
    return;
  end if;

  if v_comm_agent = 'uuid' and v_ag_id in ('bigint', 'int8') then
    drop index if exists public.idx_communications_agent_id_created_at;
    drop index if exists public.idx_communications_agent_id_lead_id_created_at;

    alter table public.communications
      drop constraint if exists communications_agent_id_fkey;

    alter table public.communications
      add column if not exists _agent_pk_migrate bigint;

    update public.communications c
    set _agent_pk_migrate = a.id
    from public.agents a
    where c.agent_id is not null
      and a.auth_user_id = c.agent_id;

    alter table public.communications
      drop column if exists agent_id;

    alter table public.communications
      rename column _agent_pk_migrate to agent_id;

    create index if not exists idx_communications_agent_id_created_at
      on public.communications(agent_id, created_at desc);

    create index if not exists idx_communications_agent_id_lead_id_created_at
      on public.communications(agent_id, lead_id, created_at desc);

    alter table public.communications
      add constraint communications_agent_id_fkey
      foreign key (agent_id) references public.agents(id) on delete set null;
  end if;
end $$;

comment on column public.communications.agent_id is 'FK to public.agents(id) — same as leads.agent_id.';


-- FILE: 20260472000000_lead_calls_voice.sql

-- Inbound voice (Twilio): one row per call + append-only events for CRM / AI pipelines.
-- `public.leads.id` and `public.agents.id` are bigint in this project.

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
      create table if not exists public.lead_calls (
        id uuid primary key default gen_random_uuid(),
        twilio_call_sid text not null unique,
        twilio_account_sid text null,
        direction text not null default 'inbound',
        from_e164 text not null,
        to_e164 text not null,
        agent_id uuid null references public.agents(id) on delete set null,
        lead_id bigint null references public.leads(id) on delete set null,
        call_status text null,
        duration_seconds int null,
        recording_url text null,
        transcript text null,
        summary text null,
        hot_lead boolean not null default false,
        escalation_reason text null,
        first_utterance text null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.lead_calls (
        id uuid primary key default gen_random_uuid(),
        twilio_call_sid text not null unique,
        twilio_account_sid text null,
        direction text not null default 'inbound',
        from_e164 text not null,
        to_e164 text not null,
        agent_id bigint null references public.agents(id) on delete set null,
        lead_id bigint null references public.leads(id) on delete set null,
        call_status text null,
        duration_seconds int null,
        recording_url text null,
        transcript text null,
        summary text null,
        hot_lead boolean not null default false,
        escalation_reason text null,
        first_utterance text null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for lead_calls: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_lead_calls_twilio_sid on public.lead_calls(twilio_call_sid);
create index if not exists idx_lead_calls_lead_id on public.lead_calls(lead_id);
create index if not exists idx_lead_calls_agent_id on public.lead_calls(agent_id);
create index if not exists idx_lead_calls_created_at on public.lead_calls(created_at desc);
create index if not exists idx_lead_calls_hot on public.lead_calls(hot_lead) where hot_lead = true;

create table if not exists public.lead_call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.lead_calls(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_call_events_call_id on public.lead_call_events(call_id);
create index if not exists idx_lead_call_events_type on public.lead_call_events(event_type);
create index if not exists idx_lead_call_events_created on public.lead_call_events(created_at desc);

comment on table public.lead_calls is 'Twilio Voice calls linked to leads/agents; transcript/summary for AI.';
comment on table public.lead_call_events is 'Append-only timeline for voice pipeline (status, gather, stream chunks, escalations).';
comment on column public.lead_calls.first_utterance is 'First Gather speech result (incremental assistant flow).';
comment on column public.lead_calls.summary is 'Optional short AI summary post-call.';


-- FILE: 20260472100000_lead_calls_crm_v2.sql

-- lead_calls / lead_call_events: CRM-aligned columns (v2). Safe when v1 (20260472000000) already applied.
-- leads.id remains bigint in this project (not uuid).

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'lead_calls'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'lead_calls' and column_name = 'from_e164'
    ) then
      alter table public.lead_calls rename column from_e164 to from_phone;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'lead_calls' and column_name = 'to_e164'
    ) then
      alter table public.lead_calls rename column to_e164 to to_phone;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'lead_calls' and column_name = 'call_status'
    ) then
      alter table public.lead_calls rename column call_status to status;
    end if;
  end if;
end $$;

alter table if exists public.lead_calls
  add column if not exists inferred_intent text null,
  add column if not exists needs_human boolean not null default false,
  add column if not exists started_at timestamptz null,
  add column if not exists ended_at timestamptz null;

-- Migrate escalation_reason → needs_human when present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lead_calls' and column_name = 'escalation_reason'
  ) then
    update public.lead_calls
      set needs_human = true
      where escalation_reason is not null and escalation_reason <> '';
  end if;
end $$;

create index if not exists idx_lead_calls_status on public.lead_calls(status);
create index if not exists idx_lead_calls_created_at_desc on public.lead_calls(created_at desc);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'lead_call_events'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'lead_call_events' and column_name = 'call_id'
    ) then
      alter table public.lead_call_events rename column call_id to lead_call_id;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'lead_call_events' and column_name = 'payload'
    ) then
      alter table public.lead_call_events rename column payload to metadata_json;
    end if;
  end if;
end $$;

comment on column public.lead_calls.inferred_intent is 'Rule-based intent label from gather/transcript.';
comment on column public.lead_calls.needs_human is 'Escalation: sensitive, angry, legal risk, or agent handoff.';


-- FILE: 20260473100000_agent_ai_settings.sql

-- Per-agent AI tone/style (SMS, email, voice, greetings). agent_id follows public.agents.id (uuid or bigint).

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
      create table if not exists public.agent_ai_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        personality text not null default 'friendly'
          check (personality in ('friendly', 'professional', 'luxury')),
        default_language text not null default 'en'
          check (default_language in ('en', 'zh', 'auto')),
        bilingual_enabled boolean not null default false,
        style_notes text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_ai_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        personality text not null default 'friendly'
          check (personality in ('friendly', 'professional', 'luxury')),
        default_language text not null default 'en'
          check (default_language in ('en', 'zh', 'auto')),
        bilingual_enabled boolean not null default false,
        style_notes text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_ai_settings: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_agent_ai_settings_agent
  on public.agent_ai_settings(agent_id);

comment on table public.agent_ai_settings is 'Per-agent AI tone/style for SMS, email, call transcript summaries, and greeting copy (compliance logic unchanged).';


-- FILE: 20260473200000_agent_voice_settings.sql

-- Per-agent phone assistant voice (Twilio playback today; OpenAI/ElevenLabs IDs reserved for future TTS / Realtime).

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
      create table if not exists public.agent_voice_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        provider text not null default 'openai'
          check (provider in ('openai', 'elevenlabs')),
        preset_voice_id text not null default 'openai_alloy',
        speaking_style text not null default 'friendly'
          check (speaking_style in ('friendly', 'professional', 'luxury')),
        default_language text not null default 'en'
          check (default_language in ('en', 'zh')),
        bilingual_enabled boolean not null default true,
        voice_clone_provider text null,
        voice_clone_remote_id text null,
        voice_clone_status text null
          check (voice_clone_status is null or voice_clone_status in ('pending', 'ready', 'failed')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_voice_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        provider text not null default 'openai'
          check (provider in ('openai', 'elevenlabs')),
        preset_voice_id text not null default 'openai_alloy',
        speaking_style text not null default 'friendly'
          check (speaking_style in ('friendly', 'professional', 'luxury')),
        default_language text not null default 'en'
          check (default_language in ('en', 'zh')),
        bilingual_enabled boolean not null default true,
        voice_clone_provider text null,
        voice_clone_remote_id text null,
        voice_clone_status text null
          check (voice_clone_status is null or voice_clone_status in ('pending', 'ready', 'failed')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_voice_settings: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_agent_voice_settings_agent
  on public.agent_voice_settings(agent_id);

comment on table public.agent_voice_settings is 'Phone assistant TTS voice: provider + preset; Twilio Polly mapping until OpenAI/ElevenLabs audio is wired. Clone columns reserved for future custom voices.';

comment on column public.agent_voice_settings.voice_clone_remote_id is 'Future: provider-side voice id after cloning (e.g. ElevenLabs voice_id).';


-- FILE: 20260473300000_agent_voice_clone_workflow.sql

-- Voice clone workflow: consent, sample storage paths, activation gate, extended status values.

alter table public.agent_voice_settings
  add column if not exists consent_confirmed boolean not null default false;

alter table public.agent_voice_settings
  add column if not exists consent_confirmed_at timestamptz null;

alter table public.agent_voice_settings
  add column if not exists voice_clone_sample_storage_path text null;

alter table public.agent_voice_settings
  add column if not exists voice_clone_preview_storage_path text null;

alter table public.agent_voice_settings
  add column if not exists voice_clone_error text null;

alter table public.agent_voice_settings
  add column if not exists use_cloned_voice boolean not null default false;

alter table public.agent_voice_settings
  add column if not exists voice_clone_preview_acknowledged_at timestamptz null;

comment on column public.agent_voice_settings.consent_confirmed is 'Agent consented to voice cloning terms before sample upload.';
comment on column public.agent_voice_settings.use_cloned_voice is 'When true and clone is ready, use provider clone id for TTS; Twilio still falls back to preset until Play URL wired.';
comment on column public.agent_voice_settings.voice_clone_preview_acknowledged_at is 'Agent confirmed they reviewed the clone preview before activation is allowed.';

-- Widen clone status for upload/processing steps.
alter table public.agent_voice_settings
  drop constraint if exists agent_voice_settings_voice_clone_status_check;

alter table public.agent_voice_settings
  add constraint agent_voice_settings_voice_clone_status_check
  check (
    voice_clone_status is null
    or voice_clone_status in ('uploaded', 'processing', 'pending', 'ready', 'failed')
  );

-- Private bucket for voice samples (server uploads via service role only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agent-voice-clones',
  'agent-voice-clones',
  false,
  26214400,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- FILE: 20260473400000_agents_auth_user_id_unique_for_upsert.sql

-- PostgREST / Supabase JS: .upsert(..., { onConflict: "auth_user_id" }) emits
-- INSERT ... ON CONFLICT ("auth_user_id") ...
-- A *partial* unique index (WHERE auth_user_id IS NOT NULL) does NOT satisfy that
-- inference — Postgres raises: 42P10 — no unique or exclusion constraint matching ON CONFLICT.
-- Fix: non-partial UNIQUE on auth_user_id (PostgreSQL still allows multiple NULLs).

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'agents'
  ) then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'auth_user_id'
  ) then
    return;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'agents'
      and indexname = 'idx_agents_auth_user_id_upsert'
  ) then
    return;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'agents'
      and indexname = 'idx_agents_auth_user_id_unique'
  ) then
    drop index public.idx_agents_auth_user_id_unique;
  end if;

  if exists (
    select 1 from public.agents
    where auth_user_id is not null
    group by auth_user_id
    having count(*) > 1
  ) then
    raise notice 'agents: duplicate non-null auth_user_id rows exist; resolve duplicates then add UNIQUE(auth_user_id) manually.';
    return;
  end if;

  create unique index idx_agents_auth_user_id_upsert
    on public.agents (auth_user_id);
exception
  when duplicate_object then null;
  when unique_violation then
    raise notice 'agents: could not add UNIQUE(auth_user_id) (violates uniqueness).';
end;
$$;


-- FILE: 20260473550000_user_profiles_split_leadsmart_propertytools.sql

-- Split identity vs app-specific data:
--   public.user_profiles       — shared: contact + auth linkage (email, invited_*, avatar, phone, name)
--   public.leadsmart_users     — LeadSmart: RBAC role, plans, tokens, trials, Stripe (agent), usage, CRM ids
--   public.propertytools_users — PropertyTools: tier basic | premium + consumer Stripe snapshot (no RBAC role)
--
-- Deprecates public.profiles: merged into user_profiles; FKs repointed to user_profiles(user_id).
-- Updates public.consume_tokens + public.increment_usage to use leadsmart_users.

-- ---------------------------------------------------------------------------
-- 1) Shared columns on user_profiles (merge target for profiles)
-- ---------------------------------------------------------------------------
alter table if exists public.user_profiles
  add column if not exists email text,
  add column if not exists invited_by uuid references auth.users (id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists is_active boolean not null default true;

create index if not exists idx_user_profiles_email on public.user_profiles (email);

-- ---------------------------------------------------------------------------
-- 2) App-specific tables
-- ---------------------------------------------------------------------------
create table if not exists public.leadsmart_users (
  user_id uuid primary key references public.user_profiles (user_id) on delete cascade,
  role text not null default 'user',
  license_number text,
  brokerage text,
  plan text not null default 'free',
  tokens_remaining int not null default 10,
  tokens_reset_date timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  trial_used boolean not null default false,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  oauth_onboarding_completed boolean not null default false,
  subscription_current_period_start timestamptz,
  subscription_current_period_end timestamptz,
  subscription_cancel_at_period_end boolean not null default false,
  estimator_usage_count int not null default 0,
  cma_usage_count int not null default 0,
  usage_reset_date timestamptz,
  last_reset_date date,
  agent_id text,
  broker_id text,
  support_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leadsmart_users_role on public.leadsmart_users (role);
create index if not exists idx_leadsmart_users_stripe_customer on public.leadsmart_users (stripe_customer_id);
create index if not exists idx_leadsmart_users_stripe_sub on public.leadsmart_users (stripe_subscription_id);

comment on table public.leadsmart_users is
  'LeadSmart-only profile: RBAC role, agent/broker fields, token/plan usage, CRM linkage ids.';

create table if not exists public.propertytools_users (
  user_id uuid primary key references public.user_profiles (user_id) on delete cascade,
  tier text not null default 'basic' check (tier in ('basic', 'premium')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_current_period_start timestamptz,
  subscription_current_period_end timestamptz,
  subscription_cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_propertytools_users_tier on public.propertytools_users (tier);
comment on table public.propertytools_users is
  'PropertyTools consumer subscription: basic (free) vs premium; no RBAC role here.';

-- ---------------------------------------------------------------------------
-- 2b) UNIQUE/PK on user_id required for ON CONFLICT — otherwise 42P10
--     (partial unique indexes do not satisfy ON CONFLICT inference.)
-- ---------------------------------------------------------------------------
do $onconflict$
declare
  has_uq_user_profiles boolean;
begin
  if to_regclass('public.leadsmart_users') is not null then
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
      where t.relname = 'leadsmart_users' and c.contype = 'p'
    ) then
      if exists (select 1 from public.leadsmart_users group by user_id having count(*) > 1) then
        raise exception 'leadsmart_users: duplicate user_id; resolve before migration';
      end if;
      alter table public.leadsmart_users add primary key (user_id);
    end if;
  end if;

  if to_regclass('public.propertytools_users') is not null then
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
      where t.relname = 'propertytools_users' and c.contype = 'p'
    ) then
      if exists (select 1 from public.propertytools_users group by user_id having count(*) > 1) then
        raise exception 'propertytools_users: duplicate user_id; resolve before migration';
      end if;
      alter table public.propertytools_users add primary key (user_id);
    end if;
  end if;

  if to_regclass('public.user_profiles') is null then
    return;
  end if;

  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
    where t.relname = 'user_profiles'
      and c.contype in ('p', 'u')
      and cardinality(c.conkey) = 1
      and (
        select a.attname::text
        from pg_attribute a
        where a.attrelid = c.conrelid and a.attnum = c.conkey[1] and not a.attisdropped
      ) = 'user_id'
  )
  into has_uq_user_profiles;

  if has_uq_user_profiles then
    return;
  end if;

  if exists (select 1 from public.user_profiles group by user_id having count(*) > 1) then
    raise exception 'user_profiles: duplicate user_id; resolve before migration';
  end if;

  alter table public.user_profiles
    add constraint user_profiles_user_id_upsert_key unique (user_id);
exception
  when duplicate_object then null;
  when unique_violation then
    raise notice 'user_profiles: could not add UNIQUE(user_id)';
end;
$onconflict$;

-- ---------------------------------------------------------------------------
-- 3) Merge public.profiles → user_profiles (run before moving columns off user_profiles)
-- ---------------------------------------------------------------------------
do $merge$
begin
  if to_regclass('public.profiles') is null then
    raise notice '20260473550000: public.profiles missing — skip merge from profiles.';
  else
    insert into public.user_profiles (user_id, full_name, email, invited_by, invited_at, is_active)
    select
      p.id,
      p.full_name,
      p.email,
      p.invited_by,
      p.invited_at,
      coalesce(p.is_active, true)
    from public.profiles p
    on conflict (user_id) do update
    set
      full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
      email = coalesce(excluded.email, public.user_profiles.email),
      invited_by = coalesce(excluded.invited_by, public.user_profiles.invited_by),
      invited_at = coalesce(excluded.invited_at, public.user_profiles.invited_at),
      is_active = coalesce(excluded.is_active, public.user_profiles.is_active);
  end if;
end $merge$;

-- ---------------------------------------------------------------------------
-- 3b) Legacy billing/RBAC columns on user_profiles (older DBs may never have had these)
--     Required before backfill SELECT — add missing columns only.
-- ---------------------------------------------------------------------------
alter table if exists public.user_profiles
  add column if not exists role text,
  add column if not exists license_number text,
  add column if not exists brokerage text,
  add column if not exists plan text default 'free',
  add column if not exists tokens_remaining int default 10,
  add column if not exists tokens_reset_date timestamptz default (date_trunc('month', now()) + interval '1 month'),
  add column if not exists trial_used boolean default false,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists oauth_onboarding_completed boolean default false,
  add column if not exists subscription_current_period_start timestamptz,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean default false,
  add column if not exists estimator_usage_count int default 0,
  add column if not exists cma_usage_count int default 0,
  add column if not exists usage_reset_date timestamptz,
  add column if not exists last_reset_date date;

-- ---------------------------------------------------------------------------
-- 4) Backfill leadsmart_users from user_profiles (while legacy columns still exist)
-- ---------------------------------------------------------------------------
insert into public.leadsmart_users (
  user_id,
  role,
  license_number,
  brokerage,
  plan,
  tokens_remaining,
  tokens_reset_date,
  trial_used,
  trial_started_at,
  trial_ends_at,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  oauth_onboarding_completed,
  subscription_current_period_start,
  subscription_current_period_end,
  subscription_cancel_at_period_end,
  estimator_usage_count,
  cma_usage_count,
  usage_reset_date,
  last_reset_date
)
select
  up.user_id,
  coalesce(nullif(trim(up.role), ''), 'user'),
  up.license_number,
  up.brokerage,
  coalesce(nullif(trim(up.plan), ''), 'free'),
  coalesce(up.tokens_remaining, 10),
  coalesce(
    up.tokens_reset_date,
    date_trunc('month', now()) + interval '1 month'
  ),
  coalesce(up.trial_used, false),
  up.trial_started_at,
  up.trial_ends_at,
  up.stripe_customer_id,
  up.stripe_subscription_id,
  up.subscription_status,
  coalesce(up.oauth_onboarding_completed, false),
  up.subscription_current_period_start,
  up.subscription_current_period_end,
  coalesce(up.subscription_cancel_at_period_end, false),
  coalesce(up.estimator_usage_count, 0),
  coalesce(up.cma_usage_count, 0),
  up.usage_reset_date,
  up.last_reset_date
from public.user_profiles up
on conflict (user_id) do nothing;

do $crm$
begin
  if to_regclass('public.profiles') is not null then
    update public.leadsmart_users ls
    set
      agent_id = coalesce(ls.agent_id, p.agent_id::text),
      broker_id = coalesce(ls.broker_id, p.broker_id::text),
      support_id = coalesce(ls.support_id, p.support_id::text)
    from public.profiles p
    where p.id = ls.user_id;
  end if;
end $crm$;

-- ---------------------------------------------------------------------------
-- 5) PropertyTools tier (uses legacy user_profiles columns; refined via billing_subscriptions)
-- ---------------------------------------------------------------------------
insert into public.propertytools_users (user_id, tier)
select up.user_id,
  case
    when lower(coalesce(up.role, '')) = 'user'
      and (
        up.plan in ('premium', 'pro')
        or lower(coalesce(up.subscription_status, '')) in ('active', 'trialing')
      )
      then 'premium'
    else 'basic'
  end
from public.user_profiles up
on conflict (user_id) do nothing;

do $tier$
begin
  if to_regclass('public.profiles') is not null and to_regclass('public.billing_subscriptions') is not null then
    update public.propertytools_users pt
    set tier = 'premium'
    from public.profiles p
    where p.id = pt.user_id
      and lower(coalesce(p.role, '')) = 'consumer'
      and exists (
        select 1
        from public.billing_subscriptions bs
        where bs.user_id = p.id
          and lower(coalesce(bs.status, '')) in ('active', 'trialing', 'past_due')
      );
  end if;
end $tier$;

insert into public.propertytools_users (user_id, tier)
select ls.user_id, 'basic'
from public.leadsmart_users ls
where not exists (select 1 from public.propertytools_users pt where pt.user_id = ls.user_id)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 6) Repoint FKs: public.profiles(id) → public.user_profiles(user_id)
-- ---------------------------------------------------------------------------
do $dropprof$
declare
  r record;
begin
  if to_regclass('public.profiles') is null then
    raise notice '20260473550000: public.profiles missing — skip FK drop/repoint.';
  else
    for r in
      select c.conname, c.conrelid::regclass as tbl
      from pg_constraint c
      where c.confrelid = 'public.profiles'::regclass
        and c.contype = 'f'
    loop
      execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    end loop;
  end if;
end $dropprof$;

create or replace function public.__pt_add_fk_user_profiles(
  p_table text,
  p_constraint text,
  p_col text,
  p_on_delete text
)
returns void
language plpgsql
as $$
declare
  v_action text := case lower(p_on_delete)
    when 'cascade' then 'on delete cascade'
    when 'set null' then 'on delete set null'
    else 'on delete cascade'
  end;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = p_table
  ) then
    return;
  end if;
  execute format(
    'alter table public.%I add constraint %I foreign key (%I) references public.user_profiles(user_id) %s',
    p_table,
    p_constraint,
    p_col,
    v_action
  );
exception
  when duplicate_object then null;
  when undefined_table then null;
end;
$$;

select public.__pt_add_fk_user_profiles('subscriptions', 'subscriptions_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('billing_subscriptions', 'billing_subscriptions_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('leadsmart_funnel_state', 'leadsmart_funnel_state_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('leadsmart_funnel_events', 'leadsmart_funnel_events_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('entitlement_usage_daily', 'entitlement_usage_daily_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('usage_events', 'usage_events_user_id_fkey', 'user_id', 'set null');
select public.__pt_add_fk_user_profiles('subscription_events', 'subscription_events_user_id_fkey', 'user_id', 'set null');
select public.__pt_add_fk_user_profiles('product_entitlements', 'product_entitlements_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('valuation_training_exports', 'valuation_training_exports_created_by_fkey', 'created_by', 'set null');

drop function if exists public.__pt_add_fk_user_profiles(text, text, text, text);

-- ---------------------------------------------------------------------------
-- 7) RPC: consume_tokens + increment_usage → leadsmart_users
-- ---------------------------------------------------------------------------
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

  select ls.plan, ls.tokens_remaining, ls.tokens_reset_date
    into v_plan, v_tokens, v_reset
  from public.leadsmart_users ls
  where ls.user_id = p_user_id
  for update;

  if not found then
    v_plan := 'free';
    v_default := public.plan_default_tokens(v_plan);
    v_tokens := v_default;
    v_reset := v_next_reset;

    insert into public.leadsmart_users (user_id, plan, tokens_remaining, tokens_reset_date)
    values (p_user_id, v_plan, v_tokens, v_reset);
  end if;

  if v_reset is null or now() >= v_reset then
    v_default := public.plan_default_tokens(v_plan);
    v_tokens := v_default;
    v_reset := v_next_reset;

    update public.leadsmart_users
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

  update public.leadsmart_users
    set tokens_remaining = greatest(0, tokens_remaining - p_tokens_required)
    where user_id = p_user_id
    returning tokens_remaining into v_tokens;

  insert into public.usage_logs(user_id, tool_name, tokens_used)
  values (p_user_id, coalesce(nullif(p_tool_name, ''), 'unknown'), p_tokens_required);

  return jsonb_build_object('ok', true, 'plan', v_plan, 'tokens_remaining', v_tokens);
end;
$$;

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

  v_reset := date_trunc('month', v_now) + interval '1 month';

  select ls.plan, ls.subscription_status, ls.usage_reset_date
    into v_plan, v_status, v_current_reset
  from public.leadsmart_users ls
  where ls.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Profile not found');
  end if;

  if v_current_reset is null or v_current_reset <= v_now then
    update public.leadsmart_users
      set estimator_usage_count = 0,
          cma_usage_count = 0,
          usage_reset_date = v_reset
    where user_id = p_user_id;
  end if;

  if lower(coalesce(v_status, '')) in ('active', 'trialing') then
    if p_tool = 'estimator' then
      update public.leadsmart_users
        set estimator_usage_count = estimator_usage_count + 1
        where user_id = p_user_id
        returning estimator_usage_count into v_used;
      return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', null, 'reset_at', v_reset);
    elsif p_tool = 'cma' then
      update public.leadsmart_users
        set cma_usage_count = cma_usage_count + 1
        where user_id = p_user_id
        returning cma_usage_count into v_used;
      return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', null, 'reset_at', v_reset);
    else
      return jsonb_build_object('ok', false, 'message', 'Unknown tool');
    end if;
  end if;

  if p_tool = 'estimator' then
    v_limit := 3;
    select ls.estimator_usage_count into v_used from public.leadsmart_users ls where ls.user_id = p_user_id;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset, 'status', 402);
    end if;
    update public.leadsmart_users
      set estimator_usage_count = estimator_usage_count + 1
      where user_id = p_user_id
      returning estimator_usage_count into v_used;
    return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset);
  elsif p_tool = 'cma' then
    v_limit := 1;
    select ls.cma_usage_count into v_used from public.leadsmart_users ls where ls.user_id = p_user_id;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset, 'status', 402);
    end if;
    update public.leadsmart_users
      set cma_usage_count = cma_usage_count + 1
      where user_id = p_user_id
      returning cma_usage_count into v_used;
    return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset);
  end if;

  return jsonb_build_object('ok', false, 'message', 'Unknown tool');
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) Drop moved columns from user_profiles
-- ---------------------------------------------------------------------------
alter table if exists public.user_profiles
  drop column if exists role,
  drop column if exists license_number,
  drop column if exists brokerage,
  drop column if exists plan,
  drop column if exists tokens_remaining,
  drop column if exists tokens_reset_date,
  drop column if exists trial_used,
  drop column if exists trial_started_at,
  drop column if exists trial_ends_at,
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id,
  drop column if exists subscription_status,
  drop column if exists oauth_onboarding_completed,
  drop column if exists subscription_current_period_start,
  drop column if exists subscription_current_period_end,
  drop column if exists subscription_cancel_at_period_end,
  drop column if exists estimator_usage_count,
  drop column if exists cma_usage_count,
  drop column if exists usage_reset_date,
  drop column if exists last_reset_date;

drop index if exists public.idx_user_profiles_stripe_customer_id;
drop index if exists public.idx_user_profiles_stripe_subscription_id;
drop index if exists public.idx_user_profiles_trial_ends_at;
drop index if exists public.idx_user_profiles_usage_reset_date;

-- ---------------------------------------------------------------------------
-- 9) Drop deprecated public.profiles
-- ---------------------------------------------------------------------------
drop table if exists public.profiles cascade;

-- ---------------------------------------------------------------------------
-- 10) updated_at triggers (only if set_updated_at exists)
-- ---------------------------------------------------------------------------
do $trg$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_updated_at') then
    execute $sql$
      drop trigger if exists trg_leadsmart_users_updated_at on public.leadsmart_users;
      create trigger trg_leadsmart_users_updated_at
      before update on public.leadsmart_users
      for each row execute function public.set_updated_at();
      drop trigger if exists trg_propertytools_users_updated_at on public.propertytools_users;
      create trigger trg_propertytools_users_updated_at
      before update on public.propertytools_users
      for each row execute function public.set_updated_at();
    $sql$;
  end if;
end $trg$;


-- FILE: 20260473560000_agents_legacy_user_id_nullable.sql

-- Legacy CRM used agents.user_id (often bigint). New rows are linked via auth_user_id (uuid) only.
-- Inserts that set auth_user_id + plan_type but omit user_id were failing with 23502.
do $agents_user_id$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'user_id'
  ) then
    return;
  end if;

  -- Only drop NOT NULL when the column is marked not-null (idempotent for re-runs).
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'user_id'
      and is_nullable = 'NO'
  ) then
    execute 'alter table public.agents alter column user_id drop not null';
  end if;
end;
$agents_user_id$;

comment on column public.agents.user_id is
  'Legacy CRM user id when present; auth-linked rows may use auth_user_id only.';


-- FILE: 20260473570000_storage_bucket_avatars.sql

-- Public bucket for profile photos (POST /api/me/avatar → storage.from('avatars')).
-- 5 MB max; common image types (matches app validation in lib/avatarUploadMime).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- FILE: 20260473600000_agent_inbox_notifications.sql

-- Unified agent inbox: hot_lead | missed_call | reminder.
-- NOTE: `public.notifications` already exists for legacy smart listing alerts (lead_id / property_id / message).
-- This table is separate so CRM inbox rows do not collide with property ping history.

create table if not exists public.agent_inbox_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  type text not null,
  priority text not null,
  title text not null,
  body text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint agent_inbox_notifications_type_chk
    check (type in ('hot_lead', 'missed_call', 'reminder')),
  constraint agent_inbox_notifications_priority_chk
    check (priority in ('high', 'medium', 'low'))
);

comment on table public.agent_inbox_notifications is
  'Agent CRM inbox: hot leads, missed calls, follow-up reminders. Distinct from public.notifications (listing alerts).';

comment on column public.agent_inbox_notifications.type is 'hot_lead | missed_call | reminder';
comment on column public.agent_inbox_notifications.priority is 'high | medium | low';

create index if not exists idx_agent_inbox_notifications_agent_created_at
  on public.agent_inbox_notifications (agent_id, created_at desc);

create index if not exists idx_agent_inbox_notifications_agent_unread
  on public.agent_inbox_notifications (agent_id)
  where read = false;

alter table public.agent_inbox_notifications enable row level security;

create policy agent_inbox_notifications_select_own
  on public.agent_inbox_notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_inbox_notifications.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

create policy agent_inbox_notifications_insert_own
  on public.agent_inbox_notifications
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.agents a
      where a.id = agent_inbox_notifications.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

create policy agent_inbox_notifications_update_own
  on public.agent_inbox_notifications
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_inbox_notifications.agent_id
        and a.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.agents a
      where a.id = agent_inbox_notifications.agent_id
        and a.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260473710000_agent_notification_preferences.sql

-- Per-agent push preferences + delivery tracking for agent_inbox_notifications.

create table if not exists public.agent_notification_preferences (
  agent_id bigint primary key references public.agents (id) on delete cascade,
  push_hot_lead boolean not null default true,
  push_missed_call boolean not null default true,
  push_reminder boolean not null default true,
  reminder_digest_minutes int not null default 15,
  updated_at timestamptz not null default now(),
  constraint agent_notification_preferences_digest_chk
    check (reminder_digest_minutes >= 5 and reminder_digest_minutes <= 120)
);

comment on table public.agent_notification_preferences is
  'LeadSmart mobile: per-category push toggles and reminder batching window.';

alter table public.agent_inbox_notifications
  add column if not exists push_sent_at timestamptz;

comment on column public.agent_inbox_notifications.push_sent_at is
  'When push was sent (or suppressed for disabled prefs). Null = pending reminder digest.';

alter table public.agent_notification_preferences enable row level security;

create policy agent_notification_preferences_select_own
  on public.agent_notification_preferences
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_notification_preferences.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

create policy agent_notification_preferences_insert_own
  on public.agent_notification_preferences
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.agents a
      where a.id = agent_notification_preferences.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

create policy agent_notification_preferences_update_own
  on public.agent_notification_preferences
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_notification_preferences.agent_id
        and a.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.agents a
      where a.id = agent_notification_preferences.agent_id
        and a.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260473820000_user_profiles_sync_contact_from_auth.sql

-- Align public.user_profiles name/email/phone with auth.users (canonical source).
-- Also backfill auth.users.phone from signup metadata when the column was empty.

update auth.users u
set phone = nullif(btrim(u.raw_user_meta_data->>'phone_e164'), '')
where (u.phone is null or btrim(u.phone) = '')
  and coalesce(btrim(u.raw_user_meta_data->>'phone_e164'), '') <> '';

update public.user_profiles p
set
  email = coalesce(nullif(trim(u.email), ''), p.email),
  phone = case
    when u.phone is not null and trim(u.phone) <> '' then trim(u.phone)
    else p.phone
  end,
  full_name = coalesce(
    nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(u.raw_user_meta_data->>'name', '')), ''),
    p.full_name
  )
from auth.users u
where p.user_id = u.id;


-- FILE: 20260473830000_storage_avatars_allow_avif.sql

-- Allow AVIF uploads (Android / modern browsers) for POST /api/me/avatar.
update storage.buckets
set allowed_mime_types = coalesce(allowed_mime_types, array[]::text[]) || array['image/avif']::text[]
where id = 'avatars'
  and not (coalesce(allowed_mime_types, array[]::text[]) @> array['image/avif']::text[]);


-- FILE: 20260473840000_storage_avatars_authenticated_policies.sql

-- Let signed-in users upload to avatars/{auth.uid()}/... using the browser client (no service role on Vercel).
-- RLS on storage.objects defaults to deny; service_role still bypasses for POST /api/me/avatar.

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects for select
to public
using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_insert_own" on storage.objects;
create policy "avatars_authenticated_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "avatars_authenticated_update_own" on storage.objects;
create policy "avatars_authenticated_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "avatars_authenticated_delete_own" on storage.objects;
create policy "avatars_authenticated_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);


-- FILE: 20260473850000_user_profiles_signup_origin_app.sql

-- First-touch app for shared auth users: drives consumer post-login routing (LeadSmart vs PropertyTools).
alter table if exists public.user_profiles
  add column if not exists signup_origin_app text;

comment on column public.user_profiles.signup_origin_app is
  'Where the account first registered: leadsmart | propertytools | mobile. Null = legacy; consumers use LeadSmart unless propertytools.';

alter table public.user_profiles drop constraint if exists user_profiles_signup_origin_app_check;

alter table public.user_profiles
  add constraint user_profiles_signup_origin_app_check
  check (signup_origin_app is null or signup_origin_app in ('leadsmart', 'propertytools', 'mobile'));


-- FILE: 20260473910000_user_profiles_canonical_prune_duplicates.sql

-- =============================================================================
-- Canonical user model (single source of truth per domain)
--
-- public.user_profiles (1:1 auth.users)
--   Shared identity + contact: user_id PK/FK auth, full_name, email, phone,
--   avatar_url, invited_by, invited_at, is_active, signup_origin_app, timestamps.
--   No RBAC, no LeadSmart billing/tokens, no PropertyTools tier.
--
-- public.leadsmart_users (1:1 user_profiles.user_id)
--   LeadSmart RBAC (role), CRM ids (agent_id, broker_id, support_id), license/brokerage,
--   plan, tokens, trials, Stripe subscription fields, oauth_onboarding_completed,
--   estimator/cma usage counters.
--
-- public.propertytools_users (1:1 user_profiles.user_id)
--   Consumer tier (basic | premium) and PropertyTools Stripe snapshot only.
--
-- Older databases may still have LeadSmart columns duplicated on user_profiles
-- (before 20260473550000 section 8 applied). This migration merges any drift
-- into leadsmart_users / propertytools_users, then drops duplicates idempotently.
-- =============================================================================

do $prune$
begin
  -- Detect legacy slab: `plan` on user_profiles was always part of the duplicated set.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'plan'
  ) then
    raise notice '20260473910000: merging legacy user_profiles columns into leadsmart_users / propertytools_users.';

    execute $merge_ls$
    update public.leadsmart_users ls
    set
      role = coalesce(nullif(trim(ls.role), ''), nullif(trim(up.role), ''), 'user'),
      license_number = coalesce(ls.license_number, up.license_number),
      brokerage = coalesce(ls.brokerage, up.brokerage),
      plan = coalesce(nullif(trim(ls.plan), ''), nullif(trim(up.plan), ''), 'free'),
      tokens_remaining = coalesce(ls.tokens_remaining, up.tokens_remaining, 10),
      tokens_reset_date = coalesce(
        ls.tokens_reset_date,
        up.tokens_reset_date,
        date_trunc('month', now()) + interval '1 month'
      ),
      trial_used = coalesce(ls.trial_used, up.trial_used, false),
      trial_started_at = coalesce(ls.trial_started_at, up.trial_started_at),
      trial_ends_at = coalesce(ls.trial_ends_at, up.trial_ends_at),
      stripe_customer_id = coalesce(ls.stripe_customer_id, up.stripe_customer_id),
      stripe_subscription_id = coalesce(ls.stripe_subscription_id, up.stripe_subscription_id),
      subscription_status = coalesce(ls.subscription_status, up.subscription_status),
      oauth_onboarding_completed = coalesce(ls.oauth_onboarding_completed, up.oauth_onboarding_completed, false),
      subscription_current_period_start = coalesce(
        ls.subscription_current_period_start,
        up.subscription_current_period_start
      ),
      subscription_current_period_end = coalesce(
        ls.subscription_current_period_end,
        up.subscription_current_period_end
      ),
      subscription_cancel_at_period_end = coalesce(
        ls.subscription_cancel_at_period_end,
        up.subscription_cancel_at_period_end,
        false
      ),
      estimator_usage_count = coalesce(ls.estimator_usage_count, up.estimator_usage_count, 0),
      cma_usage_count = coalesce(ls.cma_usage_count, up.cma_usage_count, 0),
      usage_reset_date = coalesce(ls.usage_reset_date, up.usage_reset_date),
      last_reset_date = coalesce(ls.last_reset_date, up.last_reset_date)
    from public.user_profiles up
    where up.user_id = ls.user_id
  $merge_ls$;

  execute $ins_ls$
    insert into public.leadsmart_users (
      user_id,
      role,
      license_number,
      brokerage,
      plan,
      tokens_remaining,
      tokens_reset_date,
      trial_used,
      trial_started_at,
      trial_ends_at,
      stripe_customer_id,
      stripe_subscription_id,
      subscription_status,
      oauth_onboarding_completed,
      subscription_current_period_start,
      subscription_current_period_end,
      subscription_cancel_at_period_end,
      estimator_usage_count,
      cma_usage_count,
      usage_reset_date,
      last_reset_date
    )
    select
      up.user_id,
      coalesce(nullif(trim(up.role), ''), 'user'),
      up.license_number,
      up.brokerage,
      coalesce(nullif(trim(up.plan), ''), 'free'),
      coalesce(up.tokens_remaining, 10),
      coalesce(
        up.tokens_reset_date,
        date_trunc('month', now()) + interval '1 month'
      ),
      coalesce(up.trial_used, false),
      up.trial_started_at,
      up.trial_ends_at,
      up.stripe_customer_id,
      up.stripe_subscription_id,
      up.subscription_status,
      coalesce(up.oauth_onboarding_completed, false),
      up.subscription_current_period_start,
      up.subscription_current_period_end,
      coalesce(up.subscription_cancel_at_period_end, false),
      coalesce(up.estimator_usage_count, 0),
      coalesce(up.cma_usage_count, 0),
      up.usage_reset_date,
      up.last_reset_date
    from public.user_profiles up
    where not exists (select 1 from public.leadsmart_users ls where ls.user_id = up.user_id)
    on conflict (user_id) do nothing
  $ins_ls$;

  execute $tier_pt$
    update public.propertytools_users pt
    set tier = case
      when lower(coalesce(up.role, '')) = 'user'
        and (
          nullif(trim(up.plan), '') in ('premium', 'pro')
          or lower(coalesce(up.subscription_status, '')) in ('active', 'trialing')
        )
      then 'premium'
      else pt.tier
    end
    from public.user_profiles up
    where pt.user_id = up.user_id
  $tier_pt$;

  execute $ins_pt$
    insert into public.propertytools_users (user_id, tier)
    select ls.user_id, 'basic'::text
    from public.leadsmart_users ls
    where not exists (select 1 from public.propertytools_users pt where pt.user_id = ls.user_id)
    on conflict (user_id) do nothing
  $ins_pt$;

  else
    raise notice '20260473910000: user_profiles has no legacy plan column — skip merge.';
  end if;
end;
$prune$;

-- Drop duplicated LeadSmart / billing columns from user_profiles (idempotent).
alter table if exists public.user_profiles
  drop column if exists role,
  drop column if exists license_number,
  drop column if exists brokerage,
  drop column if exists plan,
  drop column if exists tokens_remaining,
  drop column if exists tokens_reset_date,
  drop column if exists trial_used,
  drop column if exists trial_started_at,
  drop column if exists trial_ends_at,
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id,
  drop column if exists subscription_status,
  drop column if exists oauth_onboarding_completed,
  drop column if exists subscription_current_period_start,
  drop column if exists subscription_current_period_end,
  drop column if exists subscription_cancel_at_period_end,
  drop column if exists estimator_usage_count,
  drop column if exists cma_usage_count,
  drop column if exists usage_reset_date,
  drop column if exists last_reset_date;

drop index if exists public.idx_user_profiles_stripe_customer_id;
drop index if exists public.idx_user_profiles_stripe_subscription_id;
drop index if exists public.idx_user_profiles_trial_ends_at;
drop index if exists public.idx_user_profiles_usage_reset_date;

comment on table public.user_profiles is
  'Shared profile row per auth user: contact fields, avatar, invite metadata, signup_origin_app. RBAC and LeadSmart billing live in leadsmart_users; PropertyTools consumer tier in propertytools_users.';

comment on table public.leadsmart_users is
  'LeadSmart-only: role (RBAC), CRM linkage ids, plan/tokens/trials, Stripe subscription fields, tool usage counters. FK user_profiles(user_id) on delete cascade.';

comment on table public.propertytools_users is
  'PropertyTools consumer: tier basic|premium and PT Stripe snapshot. FK user_profiles(user_id) on delete cascade.';


-- FILE: 20260473920000_handle_new_user_user_profiles.sql

-- Fix auth signup trigger: 20260317000000 inserted into public.profiles, which 20260473550000 drops.
-- Without this, new auth users can exist with no public.user_profiles row (OAuth/email edge cases).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(both from concat_ws(
      ' ',
      nullif(trim(new.raw_user_meta_data->>'given_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'family_name'), '')
    )), ''),
    ''
  );

  if v_full_name = '' then
    v_full_name := coalesce(
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    );
  end if;

  v_phone := nullif(trim(new.raw_user_meta_data->>'phone_e164'), '');

  insert into public.user_profiles (user_id, full_name, email, phone)
  values (new.id, v_full_name, new.email, v_phone)
  on conflict (user_id) do update set
    email = coalesce(excluded.email, public.user_profiles.email),
    full_name = case
      when nullif(excluded.full_name, '') is not null then excluded.full_name
      else public.user_profiles.full_name
    end,
    phone = coalesce(excluded.phone, public.user_profiles.phone);

  insert into public.leadsmart_users (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  insert into public.propertytools_users (user_id, tier)
  values (new.id, 'basic')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'After insert on auth.users: ensure user_profiles + leadsmart_users + propertytools_users (replaces legacy public.profiles insert).';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- FILE: 20260474000000_lead_queue.sql

-- Lead queue: all externally captured leads enter a shared pool (agent_id IS NULL).
-- Agents claim leads for free; support staff can assign.

-- Track when a lead was claimed from the queue.
alter table public.leads
  add column if not exists claimed_at timestamptz;

-- Allow 'new_lead' notification type in agent inbox.
alter table public.agent_inbox_notifications
  drop constraint if exists agent_inbox_notifications_type_chk;

alter table public.agent_inbox_notifications
  add constraint agent_inbox_notifications_type_chk
    check (type in ('hot_lead', 'missed_call', 'reminder', 'new_lead'));

-- Index for fast queue queries (unclaimed leads).
create index if not exists idx_leads_queue_unclaimed
  on public.leads (created_at desc)
  where agent_id is null;


-- FILE: 20260475000000_performance_digests.sql

-- Weekly performance digest for agents.
-- Stores computed metrics, coaching insights, and push notification state.

create table if not exists public.performance_digests (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  title text not null,
  body text not null,
  metrics jsonb not null default '{}'::jsonb,
  insights jsonb not null default '[]'::jsonb,
  payload_json jsonb not null default '{}'::jsonb,
  push_sent_at timestamptz,
  created_at timestamptz not null default now(),

  constraint performance_digests_one_per_week
    unique (agent_id, week_start)
);

comment on table public.performance_digests is
  'Weekly agent performance recap: metrics, insights, push state.';

create index if not exists idx_performance_digests_agent_week
  on public.performance_digests (agent_id, week_start desc);

alter table public.performance_digests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'performance_digests_select_own'
  ) then
    create policy performance_digests_select_own
      on public.performance_digests
      for select to authenticated
      using (
        exists (
          select 1 from public.agents a
          where a.id = performance_digests.agent_id
            and a.auth_user_id = auth.uid()
        )
      );
  end if;
end $$;


-- FILE: 20260477000000_agent_branding.sql

-- Agent branding: editable brand name, email signature, and logo.
alter table public.agents
  add column if not exists brand_name text,
  add column if not exists signature_html text,
  add column if not exists logo_url text;

comment on column public.agents.brand_name is 'Agent-editable brand name for email signatures and client-facing content.';
comment on column public.agents.signature_html is 'Custom HTML email signature block (optional).';
comment on column public.agents.logo_url is 'Agent/brokerage logo URL for presentations and emails.';


-- FILE: 20260478000000_flyer_templates.sql

-- Saved flyers for reuse + agent default template preference.

create table if not exists public.saved_flyers (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  template_key text not null default 'classic',
  property_address text not null,
  flyer_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_flyers_agent
  on public.saved_flyers (agent_id, created_at desc);

alter table public.saved_flyers enable row level security;

create policy saved_flyers_select_own on public.saved_flyers
  for select to authenticated
  using (exists (select 1 from public.agents a where a.id = saved_flyers.agent_id and a.auth_user_id = auth.uid()));

create policy saved_flyers_insert_own on public.saved_flyers
  for insert to authenticated
  with check (exists (select 1 from public.agents a where a.id = saved_flyers.agent_id and a.auth_user_id = auth.uid()));

-- Default template preference on agents table.
alter table public.agents
  add column if not exists default_flyer_template text default 'classic';


-- FILE: 20260479000000_agent_message_settings.sql

-- Per-agent message policy (review/autosend), timing rules (quiet hours, frequency caps),
-- and the real-estate-specific compliance flags (Sunday morning, Chinese New Year).
-- Paired with the Dashboard Settings "Messages" tab.
--
-- Spec refs:
--   §2.4 (review policy + 30-day draft-only window)
--   §2.8 (quiet hours, per-contact caps, bilingual holiday pauses)

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
      create table if not exists public.agent_message_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,

        -- Review policy (§2.4)
        review_policy text not null default 'review'
          check (review_policy in ('review', 'autosend', 'per_category')),
        review_policy_by_category jsonb not null default jsonb_build_object(
          'sphere', 'review',
          'lead_response', 'review'
        ),

        -- Timing (§2.8)
        quiet_hours_start time not null default '21:00',
        quiet_hours_end   time not null default '08:00',
        use_contact_timezone boolean not null default true,
        no_sunday_morning    boolean not null default true,
        pause_chinese_new_year boolean not null default true,

        max_per_contact_per_day integer not null default 2
          check (max_per_contact_per_day between 1 and 5),
        pause_on_reply_days integer not null default 7
          check (pause_on_reply_days between 0 and 30),

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_message_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        review_policy text not null default 'review'
          check (review_policy in ('review', 'autosend', 'per_category')),
        review_policy_by_category jsonb not null default jsonb_build_object(
          'sphere', 'review',
          'lead_response', 'review'
        ),
        quiet_hours_start time not null default '21:00',
        quiet_hours_end   time not null default '08:00',
        use_contact_timezone boolean not null default true,
        no_sunday_morning    boolean not null default true,
        pause_chinese_new_year boolean not null default true,
        max_per_contact_per_day integer not null default 2
          check (max_per_contact_per_day between 1 and 5),
        pause_on_reply_days integer not null default 7
          check (pause_on_reply_days between 0 and 30),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_message_settings: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_agent_message_settings_agent
  on public.agent_message_settings(agent_id);

-- Spec §2.4: in the first 30 days of an account, the effective review_policy
-- must always be 'review' regardless of the stored value. Enforce at the DB
-- layer so API bugs can't accidentally bypass the gate. This view is what
-- the trigger scheduler should read from; the raw table is only for the UI.
create or replace view public.agent_message_settings_effective as
select
  s.id,
  s.agent_id,
  case
    when a.created_at is null then 'review'
    when a.created_at > (now() - interval '30 days') then 'review'
    else s.review_policy
  end as effective_review_policy,
  case
    when a.created_at is null then jsonb_build_object('sphere', 'review', 'lead_response', 'review')
    when a.created_at > (now() - interval '30 days') then jsonb_build_object('sphere', 'review', 'lead_response', 'review')
    else s.review_policy_by_category
  end as effective_review_policy_by_category,
  s.review_policy as stored_review_policy,
  s.review_policy_by_category as stored_review_policy_by_category,
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

comment on table  public.agent_message_settings is
  'Per-agent message delivery policy (review/autosend), quiet hours, per-contact caps, and real-estate-specific pauses. See spec §2.4 + §2.8.';
comment on view   public.agent_message_settings_effective is
  'Effective policy with the spec §2.4 30-day draft-only window forced. Read from this view in the trigger scheduler, not from the raw table.';
comment on column public.agent_message_settings.review_policy is
  'Stored policy. Effective policy respects the 30-day onboarding gate — read agent_message_settings_effective.effective_review_policy.';


-- FILE: 20260479100000_message_templates.sql

-- Message Template Library + per-agent overrides.
-- Seeded from apps/propertytoolsai/docs/proptotypes/leadsmart/leadsmart-handoff/03-template-library/leadsmart-template-library.json.
-- Schema per §03-template-library handoff, extended with `language` and `variant_of`
-- so bilingual + email-paired-with-SMS variants can be stored alongside the parent.

create table if not exists public.templates (
  id text primary key,
  category text not null check (category in ('sphere', 'lead_response', 'lifecycle')),
  name text not null,
  channel text not null check (channel in ('sms', 'email')),
  subject text null,
  body text not null,
  language text not null default 'en' check (language in ('en', 'zh')),
  variant_of text null references public.templates(id),
  placeholders jsonb not null default '[]'::jsonb,
  trigger_config jsonb not null default '{}'::jsonb,
  notes text null,
  default_status text not null default 'review'
    check (default_status in ('autosend', 'review', 'off')),
  -- source: 'spec' = from §2.5 verbatim, 'spec_expanded' = extended spec,
  -- 'invented' = entirely new (needs product validation before launch).
  source text not null default 'invented'
    check (source in ('spec', 'spec_expanded', 'invented')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_templates_category on public.templates(category);
create index if not exists idx_templates_channel  on public.templates(channel);
create index if not exists idx_templates_variant_of on public.templates(variant_of);

-- Per-agent overrides. Base templates are never mutated; edits land here.
do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'agents' and a.attname = 'id'
    and a.attnum > 0 and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.template_overrides (
        agent_id uuid not null references public.agents(id) on delete cascade,
        template_id text not null references public.templates(id) on delete cascade,
        status text not null default 'review'
          check (status in ('autosend', 'review', 'off')),
        subject_override text null,
        body_override text null,
        edited boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (agent_id, template_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.template_overrides (
        agent_id bigint not null references public.agents(id) on delete cascade,
        template_id text not null references public.templates(id) on delete cascade,
        status text not null default 'review'
          check (status in ('autosend', 'review', 'off')),
        subject_override text null,
        body_override text null,
        edited boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (agent_id, template_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for template_overrides: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_template_overrides_agent
  on public.template_overrides(agent_id);
create index if not exists idx_template_overrides_template
  on public.template_overrides(template_id);

comment on table public.templates is
  'Base message library. Seeded from the handoff JSON — 20 templates across sphere, lead_response, lifecycle. Do not mutate at runtime; per-agent edits land in template_overrides.';
comment on table public.template_overrides is
  'Per-agent template status + body/subject overrides. Null overrides inherit from the base template.';


-- FILE: 20260479200000_sphere_module.sql

-- Sphere module (§2.6): past-client + sphere contact book with equity tracking,
-- life-event signals, and per-contact trigger toggles.
--
-- IMPORTANT — these tables are based on the [ASSUMED] schema in the sphere
-- prototype. Spec §2.3 was empty in the source docx. Before this migration
-- is applied to production, PM must sign off on the fields. Compliance
-- fields (tcpa_log, consent_date, consent_source) are intentionally NOT
-- here yet — the prototype flagged them as "probably needed before real
-- build". Add them in a follow-up migration once legal reviews §2.8.
--
-- Spec refs: §2.3 (data model — EMPTY in source), §2.4 (trigger library —
-- EMPTY in source; thresholds are guesses), §2.6 (UI surfaces), §2.8
-- (compliance — needs legal review).

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'agents' and a.attname = 'id'
    and a.attnum > 0 and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.sphere_contacts (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        first_name text not null,
        last_name text null,
        email text null,
        phone text null,
        avatar_color text null,
        address text null,
        closing_address text null,
        closing_date date null,
        closing_price numeric null,
        avm_current numeric null,
        avm_updated_at timestamptz null,
        relationship_type text not null default 'sphere_non_client'
          check (relationship_type in (
            'past_buyer_client', 'past_seller_client',
            'sphere_non_client', 'referral_source'
          )),
        relationship_tag text null,
        anniversary_opt_in boolean not null default false,
        preferred_language text not null default 'en'
          check (preferred_language in ('en', 'zh')),
        last_touch_date timestamptz null,
        do_not_contact_sms boolean not null default false,
        do_not_contact_email boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.sphere_contacts (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        first_name text not null,
        last_name text null,
        email text null,
        phone text null,
        avatar_color text null,
        address text null,
        closing_address text null,
        closing_date date null,
        closing_price numeric null,
        avm_current numeric null,
        avm_updated_at timestamptz null,
        relationship_type text not null default 'sphere_non_client'
          check (relationship_type in (
            'past_buyer_client', 'past_seller_client',
            'sphere_non_client', 'referral_source'
          )),
        relationship_tag text null,
        anniversary_opt_in boolean not null default false,
        preferred_language text not null default 'en'
          check (preferred_language in ('en', 'zh')),
        last_touch_date timestamptz null,
        do_not_contact_sms boolean not null default false,
        do_not_contact_email boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for sphere_contacts: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_sphere_contacts_agent
  on public.sphere_contacts(agent_id);
create index if not exists idx_sphere_contacts_agent_last_touch
  on public.sphere_contacts(agent_id, last_touch_date);
create index if not exists idx_sphere_contacts_agent_rel
  on public.sphere_contacts(agent_id, relationship_type);

-- Life-event signals (refi detected, job change, equity milestone crossed…).
-- Spec §2.6.3: signals surface as calling-list items only — never auto-send.
create table if not exists public.sphere_signals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.sphere_contacts(id) on delete cascade,
  signal_type text not null
    check (signal_type in (
      'equity_milestone', 'refi_detected', 'job_change',
      'dormant', 'life_event_other', 'comparable_sale'
    )),
  label text not null,
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  suggested_action text null,
  payload jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  dismissed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sphere_signals_contact
  on public.sphere_signals(contact_id);
create index if not exists idx_sphere_signals_open
  on public.sphere_signals(contact_id)
  where dismissed_at is null;

-- Per-contact template trigger toggles. Overrides agent-level review policy
-- and template_overrides for this specific contact. Null = inherit.
create table if not exists public.sphere_contact_triggers (
  contact_id uuid not null references public.sphere_contacts(id) on delete cascade,
  template_id text not null references public.templates(id) on delete cascade,
  enabled boolean not null default true,
  status_override text null
    check (status_override is null or status_override in ('autosend', 'review', 'off')),
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (contact_id, template_id)
);

create index if not exists idx_sphere_contact_triggers_template
  on public.sphere_contact_triggers(template_id);

comment on table public.sphere_contacts is
  '[ASSUMED SCHEMA] Per spec §2.3 (empty in source). Past-client + sphere contact book with equity tracking. TCPA log/consent trail pending §2.8 legal review.';
comment on table public.sphere_signals is
  'Life-event signals (equity milestones, refi, job change). Spec §2.6.3: never auto-send — calling-list items only.';
comment on table public.sphere_contact_triggers is
  'Per-contact template trigger toggles. Null = inherit agent-level template_overrides.';


-- FILE: 20260479300000_message_drafts.sql

-- Approval queue: drafts generated by triggers when the effective review policy
-- is 'review'. Per spec §2.4: "every trigger produces a draft; nothing ever sends
-- without agent approval in the first 30 days."
--
-- Real send (status='sent') requires a Twilio/SendGrid integration — not in this
-- PR. `approve` moves the status to 'approved' and stamps approved_at; a future
-- sender worker reads `status='approved'` rows and dispatches.

create table if not exists public.message_drafts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid null,     -- populated via trigger below from contact.agent_id
  contact_id uuid not null references public.sphere_contacts(id) on delete cascade,
  template_id text null references public.templates(id) on delete set null,
  -- Free-form for drafts that aren't tied to a template (manual compose).
  channel text not null check (channel in ('sms', 'email')),
  subject text null,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'sent', 'failed')),
  -- Why the trigger fired (signal id, threshold crossed, etc.). Optional.
  trigger_context jsonb not null default '{}'::jsonb,
  -- Who edited the draft before approving (nullable; null = sent as-rendered).
  edited boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  rejected_at timestamptz null,
  rejected_reason text null,
  sent_at timestamptz null,
  failed_at timestamptz null,
  failure_reason text null,
  -- Soft target send time (so quiet-hours respect can delay an approved draft).
  scheduled_for timestamptz null
);

create index if not exists idx_message_drafts_agent_status
  on public.message_drafts(agent_id, status);
create index if not exists idx_message_drafts_contact
  on public.message_drafts(contact_id);
create index if not exists idx_message_drafts_pending
  on public.message_drafts(agent_id, created_at desc)
  where status = 'pending';

-- Populate agent_id automatically from the contact so the caller doesn't have
-- to pass it + the agent check can stay on the single indexed column.
create or replace function public.message_drafts_set_agent_id()
returns trigger
language plpgsql
as $$
begin
  if new.agent_id is null then
    select c.agent_id into new.agent_id
    from public.sphere_contacts c
    where c.id = new.contact_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_message_drafts_set_agent_id on public.message_drafts;
create trigger trg_message_drafts_set_agent_id
  before insert on public.message_drafts
  for each row
  execute function public.message_drafts_set_agent_id();

comment on table public.message_drafts is
  'Approval queue for Review-mode messages. Populated by triggers; cleared by agent approve/reject. Spec §2.4.';
comment on column public.message_drafts.status is
  'Lifecycle: pending → approved → sent (worker), or pending → rejected, or sent → failed.';


-- FILE: 20260479400000_trigger_firings.sql

-- Idempotency ledger for the trigger scheduler. One row per
-- (contact, template, period_key) — e.g. "anniversary:2024", "equity:25",
-- "quarter:2026Q2", "dormancy", "once_per_milestone:0.5". A unique constraint
-- means the scheduler can naively upsert and duplicates are dropped at the DB
-- layer instead of requiring a read-modify-write dance per contact.
--
-- Spec §2.4: "every trigger produces a draft; nothing ever sends without
-- agent approval in the first 30 days." The draft_id FK captures which draft
-- this firing produced (or null if the firing was suppressed by a guardrail
-- at creation time — e.g. agent-of-record mismatch).

create table if not exists public.trigger_firings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid null,     -- denormalized from contact for fast per-agent queries
  contact_id uuid not null references public.sphere_contacts(id) on delete cascade,
  template_id text not null references public.templates(id) on delete cascade,
  period_key text not null,
  draft_id uuid null references public.message_drafts(id) on delete set null,
  -- Why the trigger fired (anniversary year, equity pct, etc.) — audit trail.
  trigger_context jsonb not null default '{}'::jsonb,
  -- If the scheduler evaluated this trigger but suppressed it (e.g. opt-in
  -- missing, agent-of-record mismatch), record the reason so we don't re-fire.
  suppressed_reason text null,
  fired_at timestamptz not null default now(),
  unique (contact_id, template_id, period_key)
);

create index if not exists idx_trigger_firings_agent
  on public.trigger_firings(agent_id, fired_at desc);
create index if not exists idx_trigger_firings_draft
  on public.trigger_firings(draft_id)
  where draft_id is not null;

create or replace function public.trigger_firings_set_agent_id()
returns trigger
language plpgsql
as $$
begin
  if new.agent_id is null then
    select c.agent_id into new.agent_id
    from public.sphere_contacts c
    where c.id = new.contact_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trigger_firings_set_agent_id on public.trigger_firings;
create trigger trg_trigger_firings_set_agent_id
  before insert on public.trigger_firings
  for each row
  execute function public.trigger_firings_set_agent_id();

comment on table public.trigger_firings is
  'Idempotency ledger for the scheduler — one row per (contact, template, period). Dedups repeated cron passes.';
comment on column public.trigger_firings.period_key is
  'Stable bucket identifier, e.g. "anniversary:2024", "equity:25", "quarter:2026Q2", "dormancy", "once_per_milestone:0.5".';


-- FILE: 20260479500000_user_profiles_sms_consent.sql

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


-- FILE: 20260480000000_contacts_consolidation_drop.sql

-- Contacts consolidation — Part 1 of 3: drop legacy tables.
--
-- Pre-release nuclear rebuild: collapse `leads` (bigint) and `sphere_contacts`
-- (uuid) into a single `contacts` (uuid) table. Audit showed 19 of the 23
-- child tables of `leads` are DEAD or HALF-BUILT. Drop them all; rebuild the
-- 4 USED ones against the new uuid contacts.id in part 2.
--
-- CASCADE is intentional — we want FK dependents to go too. `basically nothing`
-- real data per product owner.

-- Sphere family (uuid FKs)
drop table if exists public.trigger_firings cascade;
drop table if exists public.message_drafts cascade;
drop table if exists public.sphere_contact_triggers cascade;
drop table if exists public.sphere_signals cascade;
drop table if exists public.sphere_contacts cascade;

-- Leads child tables — USED (rebuild in part 2)
drop table if exists public.crm_tasks cascade;
drop table if exists public.automation_logs cascade;
drop table if exists public.lead_events cascade;
drop table if exists public.lead_scores cascade;

-- Leads child tables — HALF-BUILT (defer rebuild until features ship)
drop table if exists public.sms_conversations cascade;
drop table if exists public.sms_messages cascade;
drop table if exists public.communications cascade;
drop table if exists public.email_messages cascade;
drop table if exists public.lead_calendar_events cascade;
drop table if exists public.greeting_message_history cascade;

-- Leads child tables — DEAD (drop permanently)
drop table if exists public.lead_conversations cascade;
drop table if exists public.ai_followup_jobs cascade;
drop table if exists public.client_portal_documents cascade;
drop table if exists public.client_portal_messages cascade;
drop table if exists public.client_saved_homes cascade;
drop table if exists public.lead_booking_links cascade;
drop table if exists public.lead_duplicate_candidates cascade;
drop table if exists public.lead_enrichment_runs cascade;
drop table if exists public.lead_pricing_predictions cascade;
drop table if exists public.leadsmart_runs cascade;
drop table if exists public.reengagement_logs cascade;

-- Keep automation_rules (parent of automation_logs) — no FK to leads, just referenced by.

-- The leads table itself
drop table if exists public.leads cascade;

-- Legacy helper functions that referenced leads(id) by bigint
drop function if exists public.log_lead_event(bigint, text, jsonb, text);
drop function if exists public.log_lead_event(uuid, text, jsonb, text);
drop function if exists public.bump_lead_engagement(bigint, integer);
drop function if exists public.bump_lead_engagement(uuid, integer);

-- Idempotency: if the new-schema tables already exist from a prior
-- (partial) run of this migration — or from any other source that used
-- those names — drop them too so part 2's `create table ...` statements
-- don't error with 42P07 "relation already exists". Safe because the
-- product owner confirmed pre-release / basically-no real data.
drop trigger if exists trg_agents_seed_smart_lists on public.agents;
drop table if exists public.smart_lists cascade;
drop table if exists public.automation_logs cascade;
drop table if exists public.crm_tasks cascade;
drop table if exists public.contact_scores cascade;
drop table if exists public.contact_events cascade;
drop table if exists public.contact_triggers cascade;
drop table if exists public.contact_signals cascade;
drop table if exists public.contacts cascade;

-- Functions created by parts 2 and 3 — drop so re-applying the CREATE
-- OR REPLACE doesn't leave stale trigger bindings on dropped tables.
drop function if exists public.touch_contacts_updated_at();
drop function if exists public.sync_contacts_name_fields();
drop function if exists public.touch_smart_lists_updated_at();
drop function if exists public.seed_default_smart_lists();


-- FILE: 20260480100000_contacts_consolidation_create.sql

-- Contacts consolidation — Part 2 of 3: create the new unified schema.
--
-- Single `contacts` table (uuid id) with lifecycle_stage driving which UI
-- surface(s) the row appears in. Columns are the union of what leads and
-- sphere_contacts carried, plus TCPA consent fields (previously marked
-- "probably needed before real build" in 20260479200000_sphere_module.sql).

-- Idempotent preamble: if any target table or helper function already
-- exists from a prior run of this file (or from the compat migration's
-- views getting partially applied), tear them down so the CREATE
-- statements below don't hit 42P07 "relation already exists".
-- Compat views (leads, lead_events, lead_scores, sphere_contacts) are
-- dropped first since they depend on the base tables.
drop view if exists public.sphere_contacts cascade;
drop view if exists public.lead_scores cascade;
drop view if exists public.lead_events cascade;
drop view if exists public.leads cascade;

drop trigger if exists trg_contacts_sync_status on public.contacts;
drop function if exists public.sync_contacts_status_fields();

drop table if exists public.automation_logs cascade;
drop table if exists public.crm_tasks cascade;
drop table if exists public.contact_scores cascade;
drop table if exists public.contact_events cascade;
drop table if exists public.contact_triggers cascade;
drop table if exists public.contact_signals cascade;
drop table if exists public.contacts cascade;

drop function if exists public.sync_contacts_name_fields();
drop function if exists public.touch_contacts_updated_at();

-- =============================================================================
-- contacts: the unified table
-- =============================================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,

  -- Lifecycle: drives the Smart Lists (Leads, Sphere, All) and determines
  -- which columns below are expected to be populated.
  lifecycle_stage text not null default 'lead'
    check (lifecycle_stage in (
      'lead',             -- new inquiry, not yet qualified
      'active_client',    -- in an active deal (buyer rep, listing, etc.)
      'past_client',      -- closed with this agent before
      'sphere',           -- personal/professional contact, not a client
      'referral_source',  -- sends this agent referrals
      'archived'          -- cold/dead; hidden from default views
    )),

  -- Identity
  -- Legacy single-field name kept for backward compat with the 30+ routes
  -- that write `name: "John Smith"` directly. A trigger keeps it in sync
  -- with first_name/last_name below; a future cleanup removes the
  -- duplication once all callers write the split form.
  name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  -- Formatted phone variant used by SMS paths. Kept separate from `phone`
  -- to match the legacy leads schema; a future cleanup can collapse them
  -- once the SMS state machine stops reading both.
  phone_number text,

  -- Addresses (three distinct semantic fields)
  address text,                -- where the contact lives
  property_address text,       -- subject property they're inquiring about (leads)
  closing_address text,        -- property they closed on (past_client)
  city text,                   -- derived from address, used by SMS local-context prompts
  state text,                  -- two-letter state code

  -- Funnel metadata
  source text,                 -- "Zillow", "Facebook Lead Ads", "referral", etc.
  rating text check (rating is null or rating in ('A','B','C','D','unrated')),
  notes text,

  -- Sub-state within lifecycle_stage. lifecycle_stage is the coarse bucket
  -- (lead/active_client/past_client/...) while lead_status tracks funnel
  -- micro-states: 'new' → 'contacted' → 'qualified' → 'won'/'lost'.
  -- No DB-level check here because the enum is still evolving; the TS layer
  -- validates.
  lead_status text,

  -- Engagement tracking
  engagement_score numeric default 0,
  -- Legacy alternate of engagement_score, preserved for the scoring/
  -- nurture pipeline. The two should reconcile in a follow-up.
  nurture_score numeric,
  -- Buyer/seller intent signal captured at form fill or SMS inference.
  intent text,
  last_activity_at timestamptz,
  last_contacted_at timestamptz,
  next_contact_at timestamptz,
  contact_frequency text,      -- daily | weekly | monthly | quarterly
  contact_method text,         -- email | sms | call | any
  -- Lead sub-type (e.g., 'buyer', 'seller', 'rental'). Separate from
  -- relationship_type which captures post-close vs. prospect status.
  lead_type text,
  -- Progressive-capture form stage ('name' → 'email' → 'phone' → 'complete').
  stage text,

  -- Search criteria (leads)
  search_location text,
  search_radius integer,
  price_min numeric,
  price_max numeric,
  beds integer,
  baths numeric,

  -- Prediction (rebuild placeholders — the old scoring engine is dropped in
  -- part 1, rebuild incrementally against this schema)
  prediction_score numeric,
  prediction_label text,
  prediction_factors jsonb,
  prediction_computed_at timestamptz,

  -- Automation
  automation_disabled boolean not null default false,
  report_id uuid,              -- links to property_reports when lead came from a report
  property_id uuid,            -- links to properties table when applicable

  -- Transaction (past_client, referral_source)
  closing_date date,
  closing_price numeric,
  avm_current numeric,
  avm_updated_at timestamptz,

  -- Relationship typing (sub-classification within post-close lifecycle_stages)
  relationship_type text
    check (relationship_type is null or relationship_type in (
      'past_buyer',
      'past_seller',
      'past_both',            -- bought AND sold with this agent
      'sphere',
      'referral_source',
      'prospect'
    )),
  relationship_tag text,       -- free-form: "college friend", "met at open house"
  anniversary_opt_in boolean not null default false,

  -- Consent & preferences (TCPA §2.8 — required from day 1 per product owner)
  preferred_language text not null default 'en',
  do_not_contact_sms boolean not null default false,
  do_not_contact_email boolean not null default false,
  tcpa_consent_at timestamptz,
  tcpa_consent_source text
    check (tcpa_consent_source is null or tcpa_consent_source in (
      'web_form',
      'imported_with_written_consent',
      'verbal',
      'written',
      'manual_entry'
    )),
  tcpa_consent_ip text,

  -- Legacy SMS consent flag. Kept alongside tcpa_consent_at because the
  -- SMS state machine (/api/sms/webhook, cron/send-emails) reads this
  -- directly. Treat it as "SMS opt-in confirmed" — setting
  -- tcpa_consent_at should also flip this true in the service layer.
  sms_opt_in boolean not null default false,

  -- SMS state machine columns (preserved from legacy leads schema).
  -- Future cleanup: collapse into a child `contact_sms_state` table.
  sms_ai_enabled boolean not null default true,
  sms_agent_takeover boolean not null default false,
  sms_followup_stage text,
  sms_last_outbound_at timestamptz,
  sms_last_inbound_at timestamptz,

  -- Pipeline (rebuild against contacts if/when pipeline_stages table returns)
  pipeline_stage_id uuid,

  -- Display
  avatar_color text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contacts_agent on public.contacts(agent_id);
create index idx_contacts_agent_lifecycle on public.contacts(agent_id, lifecycle_stage);
create index idx_contacts_agent_last_contacted on public.contacts(agent_id, last_contacted_at desc);
create index idx_contacts_agent_next_contact on public.contacts(agent_id, next_contact_at)
  where next_contact_at is not null;
create index idx_contacts_agent_created on public.contacts(agent_id, created_at desc);
create index idx_contacts_agent_rating on public.contacts(agent_id, rating)
  where rating is not null;
create index idx_contacts_agent_engagement on public.contacts(agent_id, engagement_score desc);

-- Email dedup: at most one row per (agent, lower(email)). Enforces the
-- "auto-merge on lower(email)" rule at the database layer so a partial
-- import or a double-submit cannot create ghosts.
create unique index uq_contacts_agent_email
  on public.contacts(agent_id, lower(email))
  where email is not null;

-- updated_at trigger
create or replace function public.touch_contacts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.touch_contacts_updated_at();


-- Keep `name` <-> `first_name`/`last_name` in sync. Writes to legacy `name`
-- populate first_name/last_name (whitespace-split). Writes to
-- first_name/last_name populate name. This lets us consolidate callers
-- incrementally without a flag-day cutover.
create or replace function public.sync_contacts_name_fields()
returns trigger language plpgsql as $$
declare
  idx int;
begin
  -- If the caller provided new first_name/last_name and not `name`,
  -- rebuild name from the split fields.
  if (
    (tg_op = 'INSERT' and new.name is null and (new.first_name is not null or new.last_name is not null))
    or
    (tg_op = 'UPDATE' and (new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name)
      and new.name is not distinct from old.name)
  ) then
    new.name := nullif(trim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), '');
  end if;

  -- If the caller provided new `name` and not first_name/last_name,
  -- split on first whitespace.
  if (
    (tg_op = 'INSERT' and new.name is not null and new.first_name is null and new.last_name is null)
    or
    (tg_op = 'UPDATE' and new.name is distinct from old.name
      and new.first_name is not distinct from old.first_name
      and new.last_name is not distinct from old.last_name)
  ) then
    idx := position(' ' in trim(new.name));
    if idx = 0 then
      new.first_name := trim(new.name);
      new.last_name := null;
    else
      new.first_name := substring(trim(new.name) from 1 for idx - 1);
      new.last_name := nullif(trim(substring(trim(new.name) from idx + 1)), '');
    end if;
  end if;

  return new;
end
$$;

create trigger trg_contacts_sync_name
  before insert or update on public.contacts
  for each row execute function public.sync_contacts_name_fields();


-- =============================================================================
-- contact_signals: life-event / equity / refi / job-change signals
-- Renamed from sphere_signals, contact_id now uuid FK to contacts.
-- =============================================================================

create table public.contact_signals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,

  signal_type text not null
    check (signal_type in (
      'refi_detected',
      'equity_milestone',
      'job_change',
      'anniversary_due',
      'listing_activity',
      'life_event_other'
    )),

  label text not null,
  confidence text not null default 'medium'
    check (confidence in ('low','medium','high')),
  suggested_action text,
  payload jsonb not null default '{}'::jsonb,

  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  dismissed_at timestamptz,

  created_at timestamptz not null default now()
);

create index idx_contact_signals_contact on public.contact_signals(contact_id);
create index idx_contact_signals_open
  on public.contact_signals(contact_id)
  where dismissed_at is null;
create index idx_contact_signals_detected on public.contact_signals(detected_at desc);


-- =============================================================================
-- contact_triggers: per-contact trigger overrides for template sends
-- Renamed from sphere_contact_triggers, contact_id now uuid.
-- =============================================================================

create table public.contact_triggers (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  template_id uuid,            -- FK to templates table added when templates migration is rebuilt
  enabled boolean not null default true,
  status_override text,        -- 'paused' | 'muted' | null
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, template_id)
);

create index idx_contact_triggers_contact on public.contact_triggers(contact_id);


-- =============================================================================
-- contact_events: engagement/activity log (rebuilt from lead_events, uuid)
-- =============================================================================

create table public.contact_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id bigint not null references public.agents(id) on delete cascade,

  event_type text not null,    -- 'email_sent' | 'sms_sent' | 'call_made' | 'note_added' | 'lead_captured' | ...
  payload jsonb not null default '{}'::jsonb,
  source text,                 -- 'manual' | 'cron' | 'webhook' | 'ai'

  created_at timestamptz not null default now()
);

create index idx_contact_events_contact on public.contact_events(contact_id, created_at desc);
create index idx_contact_events_agent on public.contact_events(agent_id, created_at desc);
create index idx_contact_events_type on public.contact_events(event_type, created_at desc);


-- =============================================================================
-- contact_scores: rebuild of lead_scores, uuid
-- =============================================================================

create table public.contact_scores (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id bigint not null references public.agents(id) on delete cascade,

  score numeric not null,
  label text,                  -- 'hot' | 'warm' | 'cold' | custom
  factors jsonb not null default '{}'::jsonb,
  model_version text,

  computed_at timestamptz not null default now()
);

create index idx_contact_scores_contact on public.contact_scores(contact_id, computed_at desc);
create index idx_contact_scores_agent_label on public.contact_scores(agent_id, label);


-- =============================================================================
-- crm_tasks: rebuild with uuid contact_id
-- =============================================================================

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,  -- nullable: tasks can be standalone

  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'open'
    check (status in ('open','in_progress','done','snoozed','cancelled')),
  priority text
    check (priority is null or priority in ('low','medium','high','urgent')),

  completed_at timestamptz,
  snoozed_until timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_crm_tasks_agent on public.crm_tasks(agent_id, status, due_at);
create index idx_crm_tasks_contact on public.crm_tasks(contact_id)
  where contact_id is not null;
create index idx_crm_tasks_agent_due on public.crm_tasks(agent_id, due_at)
  where status in ('open','in_progress');


-- =============================================================================
-- automation_logs: rebuild with uuid contact_id
-- Parent table `automation_rules` stays as-is (no FK to leads — was already
-- agent-scoped).
-- =============================================================================

create table public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete cascade,

  event text not null,         -- 'fired' | 'skipped' | 'errored' | 'dry_run'
  reason text,
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index idx_automation_logs_agent on public.automation_logs(agent_id, created_at desc);
create index idx_automation_logs_contact on public.automation_logs(contact_id, created_at desc)
  where contact_id is not null;
create index idx_automation_logs_rule on public.automation_logs(rule_id, created_at desc)
  where rule_id is not null;


-- FILE: 20260480200000_smart_lists.sql

-- Contacts consolidation — Part 3 of 3: Smart Lists.
--
-- FUB/kvCORE pattern: agents save named filters over the contacts table.
-- Three defaults ship with every new agent (Leads, Sphere, All) but agents
-- can add, rename, reorder, and delete their own. System defaults can be
-- hidden but not deleted.

-- Idempotent preamble — drop prior state so the file can be safely re-run.
drop trigger if exists trg_agents_seed_smart_lists on public.agents;
drop function if exists public.seed_default_smart_lists();
drop table if exists public.smart_lists cascade;
drop function if exists public.touch_smart_lists_updated_at();

create table public.smart_lists (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,

  name text not null,
  description text,
  icon text,                       -- optional lucide-react icon name for sidebar chip

  -- Filter shape (validated app-side, not in DB):
  --   {
  --     "lifecycle_stage": ["lead","active_client"],
  --     "rating": ["A","B"],
  --     "source": ["Zillow"],
  --     "has_signals": true,
  --     "dormant_days_gte": 90,
  --     "updated_within_days": 30,
  --     "query": "free text"
  --   }
  filter_config jsonb not null default '{}'::jsonb,

  sort_order integer not null default 0,

  -- System defaults (Leads / Sphere / All) seeded per-agent. Agents can
  -- hide them (is_hidden) but not delete, so the base segmentation stays
  -- consistent across the product.
  is_default boolean not null default false,
  is_hidden boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (agent_id, name)
);

create index idx_smart_lists_agent_sort on public.smart_lists(agent_id, sort_order);


-- Seed three defaults for every existing agent
insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
select
  a.id,
  'Leads',
  'Active pipeline — new inquiries and in-progress deals.',
  '{"lifecycle_stage":["lead","active_client"]}'::jsonb,
  0,
  true
from public.agents a
on conflict (agent_id, name) do nothing;

insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
select
  a.id,
  'Sphere',
  'Past clients, referral sources, and non-client sphere contacts.',
  '{"lifecycle_stage":["past_client","sphere","referral_source"]}'::jsonb,
  1,
  true
from public.agents a
on conflict (agent_id, name) do nothing;

insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
select
  a.id,
  'All contacts',
  'Every contact except archived.',
  '{"exclude_lifecycle_stage":["archived"]}'::jsonb,
  2,
  true
from public.agents a
on conflict (agent_id, name) do nothing;


-- When a new agent is created, auto-seed the three defaults.
create or replace function public.seed_default_smart_lists()
returns trigger language plpgsql as $$
begin
  insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
  values
    (new.id, 'Leads',
     'Active pipeline — new inquiries and in-progress deals.',
     '{"lifecycle_stage":["lead","active_client"]}'::jsonb,
     0, true),
    (new.id, 'Sphere',
     'Past clients, referral sources, and non-client sphere contacts.',
     '{"lifecycle_stage":["past_client","sphere","referral_source"]}'::jsonb,
     1, true),
    (new.id, 'All contacts',
     'Every contact except archived.',
     '{"exclude_lifecycle_stage":["archived"]}'::jsonb,
     2, true)
  on conflict (agent_id, name) do nothing;
  return new;
end
$$;

drop trigger if exists trg_agents_seed_smart_lists on public.agents;
create trigger trg_agents_seed_smart_lists
  after insert on public.agents
  for each row execute function public.seed_default_smart_lists();


-- updated_at trigger
create or replace function public.touch_smart_lists_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger trg_smart_lists_updated_at
  before update on public.smart_lists
  for each row execute function public.touch_smart_lists_updated_at();


-- FILE: 20260480300000_contacts_compat.sql

-- Contacts compat layer for apps/propertytoolsai.
--
-- The contacts-consolidation migration (20260480000000..20260480200000)
-- dropped public.leads and rebuilt the schema under `contacts`, but only
-- apps/leadsmartai's code was refactored in the same PR. apps/propertytoolsai
-- (~65 files) still runs `.from("leads")`, `.from("lead_events")`,
-- `.from("lead_scores")`, and `.from("sphere_contacts")` against the shared
-- Supabase project. Every propertytoolsai-side write is now failing with
-- 42P01 "relation does not exist".
--
-- Rather than refactor 65 more files under time pressure, this migration
-- (1) adds the extra columns that propertytoolsai's leads schema had
--     (full_address, zip_code, estimated_home_value, source_session_id,
--     confidence, timeline, status alias, etc.)
-- (2) creates updatable views `leads`, `lead_events`, `lead_scores`, and
--     `sphere_contacts` that proxy reads and writes to the new tables.
--
-- Postgres auto-updatable view rules: a view is INSERT/UPDATE/DELETE-able
-- if it is a simple SELECT from exactly one table, with no aggregates, no
-- DISTINCT, no GROUP BY, no WITH, and no window functions. All four views
-- below satisfy that, so inserts through the views land directly in the
-- underlying table.

-- =============================================================================
-- Extra columns used by propertytoolsai's leads writes
-- =============================================================================

alter table public.contacts
  add column if not exists full_address text,
  add column if not exists zip_code text,
  add column if not exists estimated_home_value numeric,
  add column if not exists source_session_id text,
  add column if not exists estimate_high numeric,
  add column if not exists estimate_low numeric,
  add column if not exists confidence text,
  add column if not exists confidence_score numeric,
  add column if not exists email_domain text,
  add column if not exists lead_quality text,
  add column if not exists source_detail text,
  add column if not exists buying_or_selling text,
  add column if not exists timeline text,
  add column if not exists traffic_source text,
  add column if not exists tool_used text,
  add column if not exists status text;  -- alias of lead_status for legacy writers

-- Keep status <-> lead_status in sync so queries on either column see the
-- same value. Writes to either side propagate to the other.
create or replace function public.sync_contacts_status_fields()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status is not null and new.lead_status is null then
      new.lead_status := new.status;
    elsif new.lead_status is not null and new.status is null then
      new.status := new.lead_status;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status and new.lead_status is not distinct from old.lead_status then
      new.lead_status := new.status;
    elsif new.lead_status is distinct from old.lead_status and new.status is not distinct from old.status then
      new.status := new.lead_status;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_contacts_sync_status on public.contacts;
create trigger trg_contacts_sync_status
  before insert or update on public.contacts
  for each row execute function public.sync_contacts_status_fields();

-- =============================================================================
-- Compatibility views — read and write against the legacy table names
-- =============================================================================

-- leads → contacts
create or replace view public.leads as
select * from public.contacts;

-- lead_events → contact_events
create or replace view public.lead_events as
select
  id,
  contact_id,
  contact_id as lead_id,  -- legacy column name alias for reads
  agent_id,
  event_type,
  payload,
  source,
  created_at
from public.contact_events;

-- A view with a derived column (`lead_id` alias) is not auto-updatable.
-- Add INSTEAD OF INSERT so propertytoolsai's `.from("lead_events").insert({
-- lead_id: ..., event_type: ... })` still lands in contact_events.
create or replace function public.lead_events_insert_redirect()
returns trigger language plpgsql as $$
begin
  insert into public.contact_events (contact_id, agent_id, event_type, payload, source)
  values (
    coalesce(new.contact_id, new.lead_id),
    new.agent_id,
    new.event_type,
    coalesce(new.payload, '{}'::jsonb),
    new.source
  );
  return new;
end
$$;

drop trigger if exists lead_events_insert_redirect on public.lead_events;
create trigger lead_events_insert_redirect
  instead of insert on public.lead_events
  for each row execute function public.lead_events_insert_redirect();

-- lead_scores → contact_scores
create or replace view public.lead_scores as
select
  id,
  contact_id,
  contact_id as lead_id,
  agent_id,
  score,
  label,
  factors,
  model_version,
  computed_at
from public.contact_scores;

create or replace function public.lead_scores_insert_redirect()
returns trigger language plpgsql as $$
begin
  insert into public.contact_scores (contact_id, agent_id, score, label, factors, model_version, computed_at)
  values (
    coalesce(new.contact_id, new.lead_id),
    new.agent_id,
    new.score,
    new.label,
    coalesce(new.factors, '{}'::jsonb),
    new.model_version,
    coalesce(new.computed_at, now())
  );
  return new;
end
$$;

drop trigger if exists lead_scores_insert_redirect on public.lead_scores;
create trigger lead_scores_insert_redirect
  instead of insert on public.lead_scores
  for each row execute function public.lead_scores_insert_redirect();

-- sphere_contacts → contacts (filtered to post-close lifecycle stages, but
-- the legacy writers don't care about the filter — they just write to the
-- name they know). For SELECT, scope to sphere-ish rows; for INSERT via
-- INSTEAD OF we let everything through since legacy CSV import already
-- handles the lifecycle mapping.
create or replace view public.sphere_contacts as
select * from public.contacts
where lifecycle_stage in ('past_client', 'sphere', 'referral_source');
-- Writes through sphere_contacts view hit the base contacts table. The
-- legacy code sets relationship_type explicitly, and contacts.
-- lifecycle_stage defaults to 'lead' — so we need an INSTEAD OF INSERT
-- to preserve the caller's intent and pick a sensible lifecycle_stage.
create or replace function public.sphere_contacts_insert_redirect()
returns trigger language plpgsql as $$
declare
  resolved_stage text;
begin
  resolved_stage := case
    when new.lifecycle_stage is not null then new.lifecycle_stage
    when new.relationship_type in ('past_buyer','past_seller','past_both') then 'past_client'
    when new.relationship_type = 'referral_source' then 'referral_source'
    else 'sphere'
  end;

  insert into public.contacts (
    agent_id, lifecycle_stage,
    name, first_name, last_name, email, phone, phone_number,
    address, property_address, closing_address, city, state, zip_code,
    source, rating, notes, lead_status, status,
    engagement_score, nurture_score, intent,
    last_activity_at, last_contacted_at, next_contact_at,
    contact_frequency, contact_method, lead_type, stage,
    search_location, price_min, price_max, beds, baths,
    closing_date, closing_price, avm_current, avm_updated_at,
    relationship_type, relationship_tag, anniversary_opt_in,
    preferred_language, do_not_contact_sms, do_not_contact_email,
    tcpa_consent_at, tcpa_consent_source, tcpa_consent_ip,
    sms_opt_in, sms_ai_enabled, sms_agent_takeover,
    full_address, estimated_home_value, source_session_id,
    avatar_color
  ) values (
    new.agent_id, resolved_stage,
    new.name, new.first_name, new.last_name, new.email, new.phone, new.phone_number,
    new.address, new.property_address, new.closing_address, new.city, new.state, new.zip_code,
    new.source, new.rating, new.notes, new.lead_status, new.status,
    coalesce(new.engagement_score, 0), new.nurture_score, new.intent,
    new.last_activity_at, new.last_contacted_at, new.next_contact_at,
    new.contact_frequency, new.contact_method, new.lead_type, new.stage,
    new.search_location, new.price_min, new.price_max, new.beds, new.baths,
    new.closing_date, new.closing_price, new.avm_current, new.avm_updated_at,
    new.relationship_type, new.relationship_tag, coalesce(new.anniversary_opt_in, false),
    coalesce(new.preferred_language, 'en'),
    coalesce(new.do_not_contact_sms, false), coalesce(new.do_not_contact_email, false),
    new.tcpa_consent_at, new.tcpa_consent_source, new.tcpa_consent_ip,
    coalesce(new.sms_opt_in, false), coalesce(new.sms_ai_enabled, true),
    coalesce(new.sms_agent_takeover, false),
    new.full_address, new.estimated_home_value, new.source_session_id,
    new.avatar_color
  );
  return new;
end
$$;

drop trigger if exists sphere_contacts_insert_redirect on public.sphere_contacts;
create trigger sphere_contacts_insert_redirect
  instead of insert on public.sphere_contacts
  for each row execute function public.sphere_contacts_insert_redirect();


-- FILE: 20260480400000_contacts_agent_id_nullable.sql

-- Contacts: agent_id must be nullable.
--
-- The home-value intake flow (apps/propertytoolsai/lib/home-value/lead.ts,
-- and the lead-capture and open-house routes) creates a lead row BEFORE
-- auto-assigning an agent. The caller has no agent_id at insert time.
--
-- My initial contacts schema marked agent_id NOT NULL, which blocked every
-- intake write with "null value in column agent_id violates not-null
-- constraint". The user hit this as "Failed to unlock report. Please try
-- again." on the valuation unlock form.
--
-- Drop the NOT NULL. Agents are populated by autoAssignLeadToAgent() post-
-- insert; unassigned rows are expected during the intake window.
--
-- Side effect on the unique index uq_contacts_agent_email (agent_id,
-- lower(email)): Postgres treats NULL != NULL for uniqueness, so two
-- unassigned rows with the same email will both be allowed. That's
-- acceptable because assignment runs within seconds of intake; dedup on
-- email only matters once an agent owns the row.

alter table public.contacts alter column agent_id drop not null;


-- FILE: 20260480500000_behavioral_tracking.sql

-- Behavioral tracking + saved searches — Phase A foundation.
--
-- Adds the data model for:
--   1. Per-contact saved searches (criteria + alert frequency)
--   2. Behavioral event ingestion (piggybacks on existing contact_events)
--   3. Intent signals (piggybacks on existing contact_signals with new types)
--   4. Nightly scoring (lands in existing contacts.engagement_score)
--
-- No new tables are strictly required — contact_events and contact_signals
-- both carry free-form text for event_type / signal_type. This migration
-- creates `contact_saved_searches` and adds indexes to support the
-- behavior-scoring cron query patterns efficiently.

-- =============================================================================
-- contact_saved_searches: per-contact "alert me when X matches Y"
-- =============================================================================

create table if not exists public.contact_saved_searches (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id bigint references public.agents(id) on delete cascade,

  -- Display + identity
  name text not null,                  -- "3bd under $1.2M in Monterey Park"

  -- Criteria: free-form JSON that the matcher translates to a Rentcast
  -- listings query. Shape (all optional):
  --   {
  --     "city": "Monterey Park",
  --     "state": "CA",
  --     "zip": "91754",
  --     "propertyType": "single_family" | "condo" | "townhouse",
  --     "priceMin": 800000,
  --     "priceMax": 1200000,
  --     "bedsMin": 3,
  --     "bathsMin": 2,
  --     "sqftMin": 1500,
  --     "radiusMiles": 2,            -- around an anchor address
  --     "anchorAddress": "1647 Arriba Dr"   -- for "watch this area"
  --   }
  criteria jsonb not null default '{}'::jsonb,

  -- Alert cadence. `never` stores the search without emailing (user reference only).
  alert_frequency text not null default 'daily'
    check (alert_frequency in ('instant','daily','weekly','never')),

  -- Matcher bookkeeping. `last_matched_listing_ids` lets us diff new matches
  -- from previously-alerted ones so the digest doesn't re-send the same
  -- listing every day.
  last_alerted_at timestamptz,
  last_matched_listing_ids jsonb not null default '[]'::jsonb,

  -- Soft-delete. Agents can "archive" a search without losing history of
  -- matches already sent.
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contact_saved_searches_contact
  on public.contact_saved_searches(contact_id);
create index idx_contact_saved_searches_agent_active
  on public.contact_saved_searches(agent_id, is_active)
  where is_active = true;
create index idx_contact_saved_searches_alert_cadence
  on public.contact_saved_searches(alert_frequency, last_alerted_at)
  where is_active = true and alert_frequency <> 'never';

-- updated_at trigger
create or replace function public.touch_saved_searches_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_saved_searches_updated_at on public.contact_saved_searches;
create trigger trg_saved_searches_updated_at
  before update on public.contact_saved_searches
  for each row execute function public.touch_saved_searches_updated_at();

-- =============================================================================
-- Indexes to support the behavior-scoring cron
-- =============================================================================

-- Scoring cron reads "all events for this contact in the last N days" per
-- contact. Agent-scoped variant for whole-book rollups.
create index if not exists idx_contact_events_contact_recent
  on public.contact_events(contact_id, created_at desc);

-- Intent-signal detection queries "same event_type, same payload.property_id,
-- repeated N times by same contact". Partial index on the hottest event types
-- keeps the hot-path query fast.
create index if not exists idx_contact_events_contact_type_recent
  on public.contact_events(contact_id, event_type, created_at desc)
  where event_type in (
    'property_view', 'property_favorite', 'search_performed',
    'return_visit', 'listing_alert_clicked', 'report_unlocked'
  );

-- =============================================================================
-- Smart List seed: "Hot this week" — contacts with intent signals
-- =============================================================================
--
-- Filter shape matches the existing ContactFilterConfig the TS side consumes.
-- `has_open_signals: true` + `updated_within_days: 7` narrows to contacts
-- that fired a signal or had engagement activity in the last week.

insert into public.smart_lists
  (agent_id, name, description, filter_config, sort_order, is_default)
select
  a.id,
  'Hot this week',
  'Contacts with recent intent signals or high engagement in the last 7 days.',
  '{"has_open_signals":true,"updated_within_days":7}'::jsonb,
  3,
  true
from public.agents a
on conflict (agent_id, name) do nothing;

-- Also update the seed trigger so new agents get this list too.
create or replace function public.seed_default_smart_lists()
returns trigger language plpgsql as $$
begin
  insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
  values
    (new.id, 'Leads',
     'Active pipeline — new inquiries and in-progress deals.',
     '{"lifecycle_stage":["lead","active_client"]}'::jsonb,
     0, true),
    (new.id, 'Sphere',
     'Past clients, referral sources, and non-client sphere contacts.',
     '{"lifecycle_stage":["past_client","sphere","referral_source"]}'::jsonb,
     1, true),
    (new.id, 'All contacts',
     'Every contact except archived.',
     '{"exclude_lifecycle_stage":["archived"]}'::jsonb,
     2, true),
    (new.id, 'Hot this week',
     'Contacts with recent intent signals or high engagement in the last 7 days.',
     '{"has_open_signals":true,"updated_within_days":7}'::jsonb,
     3, true)
  on conflict (agent_id, name) do nothing;
  return new;
end
$$;


-- FILE: 20260480600000_contacts_user_id_retire_legacy_saved_searches.sql

-- contacts.user_id + retire lead_saved_searches.
--
-- Phase B2 prereq. Adds the auth.users linkage so propertytoolsai's
-- consumer side can resolve the logged-in user to their contact row,
-- and drops the legacy lead_saved_searches table that was written to
-- by /api/match/save-search (now retired — replaced by the unified
-- contact_saved_searches + /api/consumer/saved-searches).

-- Add user_id FK back (was on legacy leads, lost in consolidation).
-- on delete set null: if a user deletes their auth account, the
-- contact row stays (agent still owns the data / compliance audit
-- trail), just detached from the account.
alter table public.contacts
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_contacts_user_id
  on public.contacts(user_id)
  where user_id is not null;

-- Retire legacy table. Pre-release / basically-no-data so drop is safe.
-- No backfill into contact_saved_searches because the old rows were
-- keyed on lead_id (bigint) which no longer exists, and the shape of
-- its `preferences` jsonb doesn't cleanly map to SavedSearchCriteria.
drop table if exists public.lead_saved_searches cascade;


-- FILE: 20260480700000_rating_manual_override.sql

-- Auto-rating v1: engagement_score → rating, with manual override escape hatch.
--
-- The nightly behavior-score cron maps engagement_score to A/B/C/D and
-- writes it to contacts.rating. For cases where the agent's judgment
-- beats the model (they've met the lead in person, know context the
-- behavior graph doesn't), flipping rating_manual_override=true on a
-- row pins the current rating — the cron will skip that row until the
-- override is cleared.
--
-- Audit trail for every auto-rating change lives in contact_events
-- (event_type='rating_changed'), so agents can see when + why a rating
-- moved without needing a separate table.

alter table public.contacts
  add column if not exists rating_manual_override boolean not null default false;


-- FILE: 20260480800000_contact_property_favorites.sql

-- contact_property_favorites — user-declared high-interest listings.
--
-- Complements contact_saved_searches (criteria-based intent) and
-- contact_events (behavioral signal): favorites are the strongest
-- consumer-declared interest we capture, because the user explicitly
-- chose "I like THIS house".
--
-- Snapshot fields (address, price, etc.) are stored at favorite-time
-- rather than fetched live so (1) the UI can render a user's
-- favorites even after a listing goes off-market and (2) the
-- agent-facing "suggested properties" query doesn't need a Rentcast
-- round-trip for every favorite it inspects.
--
-- Unique (contact_id, property_id) prevents double-favorites — the
-- consumer UI calls POST idempotently.

create table if not exists public.contact_property_favorites (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id bigint references public.agents(id) on delete set null,

  -- External listing identifier (Rentcast listing id). Not an FK
  -- because listings aren't stored as a local table yet.
  property_id text not null,

  -- Snapshot at favorite-time
  address text,
  city text,
  state text,
  zip text,
  price numeric,
  beds integer,
  baths numeric,
  sqft integer,
  property_type text,
  photo_url text,

  -- Consumer's personal note, e.g., "love the kitchen remodel"
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (contact_id, property_id)
);

create index if not exists idx_contact_favorites_contact
  on public.contact_property_favorites(contact_id, created_at desc);
create index if not exists idx_contact_favorites_agent
  on public.contact_property_favorites(agent_id, created_at desc)
  where agent_id is not null;

create or replace function public.touch_contact_favorites_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_contact_favorites_updated_at on public.contact_property_favorites;
create trigger trg_contact_favorites_updated_at
  before update on public.contact_property_favorites
  for each row execute function public.touch_contact_favorites_updated_at();

-- Bump property_favorite weight in the scoring engine? No schema
-- change needed — scoring.ts already weights property_favorite at 6.
-- Adding rows here fires the event directly via the API layer.


-- FILE: 20260480900000_agent_property_recommendations.sql

-- agent_property_recommendations — agent-curated "here are N homes
-- I picked for you" sends.
--
-- The agent picks listings (from search, comps, AI suggestions, or
-- their own favorites list) + writes a personal note. One row per
-- send, tracking opens + clicks per the listing_alert_opened /
-- listing_alert_clicked pattern already used for saved-search
-- digests. Click data flows back into contact_events via the
-- /api/alerts/click redirect which dedups by presence of
-- recommendation_id vs saved_search_id in the querystring.

create table if not exists public.agent_property_recommendations (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  -- Subject + personal note composed by the agent
  subject text,
  note text,

  -- Listings payload. Each entry carries a snapshot (address, price,
  -- beds/baths/sqft, photo_url, property_type) so the email template
  -- renders without re-fetching, and the tracking landing still works
  -- if the listing goes off-market before the recipient opens.
  -- Shape:
  --   [{ property_id, address, city, state, zip, price, beds, baths,
  --      sqft, property_type, photo_url }]
  listings jsonb not null default '[]'::jsonb,

  sent_at timestamptz,
  opened_at timestamptz,
  first_clicked_at timestamptz,
  click_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_property_recs_contact
  on public.agent_property_recommendations(contact_id, created_at desc);
create index if not exists idx_agent_property_recs_agent
  on public.agent_property_recommendations(agent_id, created_at desc);

create or replace function public.touch_agent_property_recs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_agent_property_recs_updated_at on public.agent_property_recommendations;
create trigger trg_agent_property_recs_updated_at
  before update on public.agent_property_recommendations
  for each row execute function public.touch_agent_property_recs_updated_at();


-- FILE: 20260481000000_agent_photo_url.sql

-- Agent photo (headshot) — separate from logo_url.
--
-- Real-estate email signatures typically have TWO images:
--   - Headshot (circular, ~80px, next to the agent's name)
--   - Brokerage logo (rectangular, ~120×40px, lower-right)
-- 20260477000000_agent_branding already added logo_url; this adds
-- agent_photo_url so the signature composer can render both slots
-- independently without the agent having to choose.

alter table public.agents
  add column if not exists agent_photo_url text;

comment on column public.agents.agent_photo_url is
  'Agent headshot (circular) — separate from logo_url (brokerage logo). Used in email signatures.';


-- FILE: 20260482000000_agents_service_areas_v2.sql

-- agents.service_areas_v2 — structured state/county/city service area picks.
--
-- Context: the old `service_areas text[]` column stored free-form strings
-- like "alhambra,ca" or raw zip codes mixed together. The downstream
-- matcher in propertytoolsai/lib/matching.ts did substring/regex compares
-- which are fragile ("Los Angeles" matches "New Los Angeles" etc.) and
-- can't express "I serve all of this county".
--
-- New structured format stored as jsonb:
--   [
--     { "state": "CA", "county": "Los Angeles", "city": "Alhambra" },
--     { "state": "CA", "county": "Orange",      "city": null }     -- all cities
--   ]
--
-- Dual-write strategy: the new onboarding picker writes v2; the legacy
-- `service_areas` column continues to receive a flattened string array
-- ("city, state" / "All of county, state") for backwards compatibility
-- with any call sites still on the old format. Matcher reads v2 first
-- and falls back to v1.

alter table public.agents
  add column if not exists service_areas_v2 jsonb;

comment on column public.agents.service_areas_v2 is
  'Structured service-area picks: array of { state, county, city? } objects. '
  'city=null means the agent covers all cities in that county. '
  'Supersedes service_areas (free-form strings); matcher falls back to '
  'service_areas if this is null/empty.';

-- GIN index for downstream filtering (matcher queries will probe state/county).
create index if not exists agents_service_areas_v2_gin
  on public.agents
  using gin (service_areas_v2);


-- FILE: 20260482100000_retire_review_policy_onboarding_gate.sql

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


-- FILE: 20260483000000_localization_preferences.sql

-- Localization preferences — per-lead outbound language, per-user UI + outbound
-- defaults, and the on-demand translation cache backing the inbox toggle.
--
-- Design notes:
--   * All language columns are plain `text`, NOT Postgres enums. Adding a
--     new language should be a one-line addition to `lib/locales/registry.ts`
--     (and its template-seed equivalent), NOT another DDL migration. The
--     app layer validates values through `coerceLocale()` from that
--     registry.
--   * The pre-existing `templates.language` column was typed as an
--     enum-with-CHECK `check (language in ('en', 'zh'))` (see
--     20260479100000_message_templates.sql). We drop that check so it
--     matches the new pattern and future locales need no migration here.
--   * `user_profiles.ui_language` vs `user_profiles.default_outbound_language`
--     are independent. Typical bilingual agent sets both to the same
--     value, but the schema doesn't assume that — it lets agents who
--     operate in English still default their lead outbound to zh, or vice
--     versa, as they grow their book.
--   * `contacts.preferred_language` sits on the unified contacts table
--     (20260480100000_contacts_consolidation_create.sql) and is nullable.
--     Null means "no override — fall through to the agent's default."

-- ── contacts / leads ────────────────────────────────────────────────────
alter table if exists public.contacts
  add column if not exists preferred_language text null;

comment on column public.contacts.preferred_language is
  'BCP-47 base id (e.g. ''zh'', ''en'') the AI should use for outbound messages '
  'to this contact. NULL means "use the agent''s default_outbound_language". '
  'Validated at the app layer against lib/locales/registry.ts; kept as text '
  'so adding a new language does not require a migration.';

create index if not exists idx_contacts_preferred_language
  on public.contacts(preferred_language)
  where preferred_language is not null;

-- ── user_profiles (signed-in agents / users) ───────────────────────────
-- Only `ui_language` lives here. The agent-side default for OUTBOUND
-- language reuses the existing `agent_ai_settings.default_language`
-- column (values 'en' | 'zh' | 'auto') — that's already the field the AI
-- message builders read for language preference, so we avoid a second
-- source of truth. The resolver coerces 'auto' / unknown values back to
-- the registry default.
alter table if exists public.user_profiles
  add column if not exists ui_language text null;

comment on column public.user_profiles.ui_language is
  'BCP-47 base id the dashboard UI renders in for this user. NULL falls '
  'through to ''en''. Gated: only takes effect when lib/locales/registry.ts '
  'has ui.enabled=true for the chosen locale, which currently is only '
  '''en''. Turning on ''zh'' requires 100%% message-catalog coverage.';

-- ── templates.language: relax the enum-style CHECK ─────────────────────
-- Drop the existing CHECK constraint (if it was given the default
-- auto-generated name) so the column becomes open-ended text. App-layer
-- validation via coerceLocale() now owns the acceptable-values set.
do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'templates'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%language%in%(%en%zh%)%';

  if v_constraint_name is not null then
    execute format('alter table public.templates drop constraint %I', v_constraint_name);
  end if;
end $$;

comment on column public.templates.language is
  'BCP-47 base id (e.g. ''en'', ''zh''). Previously CHECK-constrained to '
  '(''en'',''zh''); the constraint was dropped so adding new languages is '
  'a data change in lib/locales/registry.ts, not a DDL migration. App-layer '
  'validation via coerceLocale() owns the acceptable-values set.';

-- ── message_translation_cache ──────────────────────────────────────────
-- Backs the inbox "Translate to English / 翻译为英文" toggle. Content-
-- addressed by sha256(text) so the same sentence sent to N leads only
-- hits the LLM once. Independent of message ids so the cache survives
-- re-fetches and doesn't require FK migration if message tables change.
create table if not exists public.message_translation_cache (
  text_hash text not null,
  source_locale text null,
  target_locale text not null,
  translated_text text not null,
  created_at timestamptz not null default now(),
  primary key (text_hash, source_locale, target_locale)
);

-- Postgres treats NULL distinctly in primary keys — we want the lookup
-- "hash + NULL source + en target" to match on repeat calls. Add a unique
-- index with NULLS NOT DISTINCT so NULL source_locale collapses into a
-- single cache row instead of accumulating duplicates.
-- (Requires PG 15+. If the target cluster is older, the duplicate-row risk
-- is tiny — re-computes a few extra translations — and the ON CONFLICT
-- in the app-layer insert handles it.)
do $$
begin
  if current_setting('server_version_num')::int >= 150000 then
    execute 'create unique index if not exists '
            'ix_message_translation_cache_nulls_not_distinct '
            'on public.message_translation_cache(text_hash, source_locale, target_locale) '
            'nulls not distinct';
  end if;
end $$;

comment on table public.message_translation_cache is
  'On-demand translation cache backing the inbox translate toggle. Keyed by '
  'sha256(text) so the same message body translated for different leads is '
  'only computed once. Source/target are BCP-47 base ids; source may be NULL '
  'when the caller did not know the source language at write time.';


-- FILE: 20260483050000_seed_en_canonicals.sql

-- Seed: all 27 canonical English template rows.
--
-- Why a migration for data that was previously script-seeded:
--   * The JSON source (apps/propertytoolsai/docs/proptotypes/…) was
--     untracked in git, so the canonical-library state drifted between
--     environments depending on which operator ran the seed script.
--   * With this migration, `templates` reaches a deterministic shape on
--     every db push. Re-runs + double-seeds are no-ops thanks to
--     ON CONFLICT DO NOTHING, so the existing seed-message-templates.mjs
--     workflow continues to function without surprise.
--
-- Content: 20 pre-existing canonicals (verbatim from the JSON)
--          + 7 new canonicals introduced this PR:
--            LR-TINT, LR-TR, LR-OS, LR-OA, LR-CC (transaction milestones)
--            BD-01, RA-01E (sphere additions)

-- HA-01 · sphere · sms · Home anniversary
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'HA-01', 'sphere', 'Home anniversary', 'sms',
  null,
  $body$Hey {{first_name}} — hard to believe it's been {{years}} year{{s}} since we closed on {{street_name}}. Hope you're still loving the place. Current estimated value is {{avm_display}} (up {{delta_display}} from when you bought). If you ever want me to run a deeper look, just say the word. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "years", "s", "street_name", "avm_display", "delta_display", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "closing_date", "time_local": "09:00", "frequency": "yearly", "requires": ["anniversary_opt_in=true", "relationship_type in [past_buyer_client, past_seller_client]"]}'::jsonb,
  $note$No autosend in first 30 days of agent onboarding.$note$,
  'review', 'spec'
) on conflict (id) do nothing;

-- HA-01E · sphere · email · Home anniversary · email variant
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'HA-01E', 'sphere', 'Home anniversary · email variant', 'email',
  $subj${{years}} year{{s}} in your {{street_name}} home$subj$,
  $body$Hi {{first_name}},

Can't believe it's been {{years}} year{{s}}. I still remember the night we went back and forth with the seller on the inspection — you handled it better than most agents I know.

Your home at {{street_name}} is currently estimated at {{avm_display}}. That's {{delta_display}} above what you paid — not that you're going anywhere, but it's good to know.

If you ever want me to pull the comps or look at what a refi might do for you, I'm a text away. Otherwise — enjoy the place.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "years", "s", "street_name", "avm_display", "delta_display", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "closing_date", "paired_with": "HA-01", "condition": "contact has email_on_file=true"}'::jsonb,
  $note$Expansion of spec §2.5 HA-01b. Pair with HA-01 SMS for full-contact clients.$note$,
  'review', 'spec_expanded'
) on conflict (id) do nothing;

-- EQ-01 · sphere · email · Quarterly equity update
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'EQ-01', 'sphere', 'Quarterly equity update', 'email',
  $subj${{quarter}} update on your {{neighborhood}} home$subj$,
  $body${{first_name}},

Quick quarterly snapshot on your place at {{street_name}}.

Purchased {{closing_date_short}} for {{closing_price_display}}. Currently estimated at {{avm_display}} — {{delta_pct}}% above purchase, roughly {{delta_display}} in equity.

Two things worth noting in {{neighborhood}} this quarter: median price is {{median_price}}, and days on market {{dom_change_phrase}} versus last quarter.

If you ever want me to break down what this means for your plans — refi, rental, selling — just hit reply. No pitch, promise.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "street_name", "closing_date_short", "closing_price_display", "avm_display", "delta_pct", "delta_display", "quarter", "neighborhood", "median_price", "dom_change_phrase", "agent_first_name"]'::jsonb,
  '{"type": "calendar_quarter_start", "requires": ["relationship_type in [past_buyer_client, past_seller_client]", "agent_of_record_match=true"]}'::jsonb,
  $note$`dom_change_phrase` should render as 'shortened from 18 to 12 days' or 'lengthened from 12 to 18 days'.$note$,
  'review', 'spec'
) on conflict (id) do nothing;

-- EM-01 · sphere · sms · Equity milestone · crossed +25%
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'EM-01', 'sphere', 'Equity milestone · crossed +25%', 'sms',
  null,
  $body$Quick heads-up, {{first_name}} — your place on {{street_name}} just crossed 25% equity growth since you bought. Estimated value is now around {{avm_display}}. Not suggesting you do anything with it — just wanted you to know. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "street_name", "avm_display", "agent_first_name"]'::jsonb,
  '{"type": "threshold_crossed", "field": "equity_pct", "threshold": 0.25, "direction": "upward", "frequency": "once_per_milestone"}'::jsonb,
  $note$The 'not suggesting you do anything' line is load-bearing. Keeps it from feeling like a pitch.$note$,
  'review', 'spec'
) on conflict (id) do nothing;

-- EM-02 · sphere · sms · Equity milestone · crossed +50%
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'EM-02', 'sphere', 'Equity milestone · crossed +50%', 'sms',
  null,
  $body${{first_name}}, milestone moment: your {{street_name}} place just crossed 50% equity gained since you bought it in {{closing_year}}. That puts it around {{avm_display}}. Congrats — you picked well. If you ever want to talk through what that opens up, I'm here. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "street_name", "closing_year", "avm_display", "agent_first_name"]'::jsonb,
  '{"type": "threshold_crossed", "field": "equity_pct", "threshold": 0.5, "direction": "upward", "frequency": "once_per_milestone"}'::jsonb,
  $note$Warmer than EM-01 because 50% is a real milestone worth acknowledging.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- DR-01 · sphere · sms · Dormant re-engage
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'DR-01', 'sphere', 'Dormant re-engage', 'sms',
  null,
  $body$Hey {{first_name}}, realized it's been a minute. How are things? Anyone in your circle thinking about a move this spring? No pressure — just keeping a list. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "agent_first_name", "season"]'::jsonb,
  '{"type": "dormancy", "field": "last_touch_date", "threshold_days": 120, "frequency": "once", "suppress_if": "any_signal_fired_within_30_days"}'::jsonb,
  $note$Rotate 'spring' to 'summer/fall/winter' by month. {{season}} placeholder is dynamically populated.$note$,
  'review', 'spec'
) on conflict (id) do nothing;

-- RA-01 · sphere · sms · Referral thank-you
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'RA-01', 'sphere', 'Referral thank-you', 'sms',
  null,
  $body${{first_name}} — {{referral_name}} just reached out because of you. That means more than you know. I'll take great care of them. Thank you. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "referral_name", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "new_lead_cites_this_contact_as_referrer", "latency_max_hours": 2}'::jsonb,
  $note$Send within 2 hours of referral intake. Timing is the whole point.$note$,
  'autosend', 'spec'
) on conflict (id) do nothing;

-- JS-01 · sphere · sms · Just sold in your neighborhood
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'JS-01', 'sphere', 'Just sold in your neighborhood', 'sms',
  null,
  $body${{first_name}} — {{address_short}} just sold for {{sold_price}}. Two houses from you. Thought you'd want to know what that does for your neighborhood comps. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "address_short", "sold_price", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "comparable_sale_within_half_mile", "requires": ["same_zip", "sq_ft_within_15pct"], "frequency_cap": "1_per_90_days_per_contact"}'::jsonb,
  $note$Requires MLS feed. Frequency cap is important — neighbors get annoyed by over-sending.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-Z01 · lead_response · sms · Zillow buyer inquiry · first touch
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-Z01', 'lead_response', 'Zillow buyer inquiry · first touch', 'sms',
  null,
  $body$Hi {{first_name}}, this is {{agent_first_name}} with {{brokerage}} — saw you asked about {{property_address}}. Are you hoping to tour this weekend or just gathering info for now?$body$,
  'en',
  null,
  '["first_name", "agent_first_name", "brokerage", "property_address"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_buyer", "latency_max_seconds": 60}'::jsonb,
  $note$From spec §1.5 verbatim. The weekend/info binary is the whole trick.$note$,
  'autosend', 'spec'
) on conflict (id) do nothing;

-- LR-Z02 · lead_response · email · Zillow buyer inquiry · first touch · email
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-Z02', 'lead_response', 'Zillow buyer inquiry · first touch · email', 'email',
  $subj$About {{property_short_address}}$subj$,
  $body$Hi {{first_name}},

Saw your note come through about {{property_address}} — nice place. Three bed, {{bathrooms}} bath, {{square_footage}} sq ft if I remember the listing right.

Quick question so I can be useful: are you looking to tour this weekend, or still in the research phase? Either way I can send you two or three similar listings in {{neighborhood}} that might be a better fit — I know a few that haven't hit Zillow yet.

Text me back at {{agent_phone}} if that's easier than email. Talk soon.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "property_address", "property_short_address", "bathrooms", "square_footage", "neighborhood", "agent_phone", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_buyer", "paired_with": "LR-Z01", "delay_after_sms_seconds": 120}'::jsonb,
  $note$Only use 'haven't hit Zillow yet' line if agent has real pocket listings.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LR-Z03 · lead_response · sms · Zillow seller inquiry · first touch
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-Z03', 'lead_response', 'Zillow seller inquiry · first touch', 'sms',
  null,
  $body$Hi {{first_name}}, this is {{agent_first_name}} with {{brokerage}}. Saw you looked up a value for {{address}}. Happy to send over a real CMA — more accurate than the Zestimate. Are you thinking of selling soon or just checking the number?$body$,
  'en',
  null,
  '["first_name", "agent_first_name", "brokerage", "address"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_seller", "latency_max_seconds": 60}'::jsonb,
  $note$CMA vs Zestimate is the differentiator. Sellers already know they're not the same thing.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LR-OH01 · lead_response · sms · Open-house sign-in · follow-up
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-OH01', 'lead_response', 'Open-house sign-in · follow-up', 'sms',
  null,
  $body$Hey {{first_name}} — {{agent_first_name}} here, we met at the {{property_address}} open house this afternoon. Wanted to say thanks for stopping by. What'd you think? Was it in the running, or more of a drive-by?$body$,
  'en',
  null,
  '["first_name", "agent_first_name", "property_address"]'::jsonb,
  '{"type": "event", "event": "open_house_sign_in", "delay_hours": 3, "condition": "after_open_house_end"}'::jsonb,
  $note$'In the running or drive-by' gives permission to disqualify without rudeness.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-NR01 · lead_response · sms · No-reply follow-up · day 2
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-NR01', 'lead_response', 'No-reply follow-up · day 2', 'sms',
  null,
  $body$Hey {{first_name}} — quick one. A few new listings hit today in {{neighborhood}} under {{price_max}}. Want me to send the shortlist? (It's a pretty short list.)$body$,
  'en',
  null,
  '["first_name", "neighborhood", "price_max"]'::jsonb,
  '{"type": "inactivity", "reference": "first_touch_sent", "threshold_hours": {"min": 36, "max": 48}, "frequency": "once", "requires": "agent_has_new_listings_in_neighborhood=true"}'::jsonb,
  $note$Suppress if no real listings to share. Do not send a generic 'just following up'.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-NR02 · lead_response · sms · No-reply follow-up · day 7 · opt-out
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-NR02', 'lead_response', 'No-reply follow-up · day 7 · opt-out', 'sms',
  null,
  $body$Last one from me, {{first_name}} — if {{neighborhood}} isn't right or the timing's off, totally fine. I'll stop texting. But if you want me to keep an eye out for anything specific, text me what you'd actually want and I'll watch for it.$body$,
  'en',
  null,
  '["first_name", "neighborhood"]'::jsonb,
  '{"type": "inactivity", "reference": "first_touch_sent", "threshold_days": 7, "frequency": "once", "next_state": "slow_drip"}'::jsonb,
  $note$The 'I'll stop texting' opt-out often triggers a reply. Withdrawal of attention prompts engagement.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-TOUR · lead_response · sms · Tour confirmation
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-TOUR', 'lead_response', 'Tour confirmation', 'sms',
  null,
  $body$Locked in, {{first_name}}: {{tour_day}} at {{tour_time}}, {{property_address}}. I'll meet you out front — I drive a {{agent_car}} if that helps. Park anywhere on the street. Text if anything changes. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "tour_day", "tour_time", "property_address", "agent_car", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "tour_scheduled", "latency_max_seconds": 30}'::jsonb,
  $note${{agent_car}} set during agent onboarding. Removes parking-lot awkwardness at tour start.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-W01 · lifecycle · email · Welcome · signup + 2 min
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-W01', 'lifecycle', 'Welcome · signup + 2 min', 'email',
  $subj$You're in. Here's what happens next.$subj$,
  $body${{first_name}},

Welcome. Your trial is live — 14 days, no credit card, cancel anytime.

Three things that'll take you ten minutes total:

1 — Connect a lead source. Zillow, Follow Up Boss, your IDX, Facebook Lead Ads. Whatever you have. {{connect_url}}

2 — Record a 30-second voice sample. This is how we teach the AI to sound like you, not like a bot. {{voice_url}}

3 — Send yourself a test lead. Paste a name and phone into the test lead form — LeadSmart will reply to you as if you were a real Zillow inquiry. See what it sounds like before a real lead sees it.

That's it. Real leads start getting real replies the moment a source is connected.

If you're stuck, reply to this email. A real person answers — usually within the hour.

— The LeadSmart team$body$,
  'en',
  null,
  '["first_name", "connect_url", "voice_url"]'::jsonb,
  '{"type": "event", "event": "trial_signup", "delay_minutes": 2}'::jsonb,
  $note$No exclamation points. No 'welcome aboard'. 'Real person answers' must be true.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-FS · lifecycle · email · First success · first lead replied
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-FS', 'lifecycle', 'First success · first lead replied', 'email',
  $subj$Your first lead just replied.$subj$,
  $body${{first_name}},

At {{reply_time}} today, {{lead_name}} replied to the message LeadSmart sent on your behalf. That reply is waiting in your inbox.

Worth noting: {{lead_name}} came in from {{source}} at {{arrival_time}}. First reply went out at {{first_reply_time}} — {{reply_latency}} seconds later.

That's the whole product in one transaction. The next 500 leads work the same way.

— The LeadSmart team$body$,
  'en',
  null,
  '["first_name", "reply_time", "lead_name", "source", "arrival_time", "first_reply_time", "reply_latency"]'::jsonb,
  '{"type": "event", "event": "first_lead_reply_ever", "latency_max_minutes": 5}'::jsonb,
  $note$Most important email in the lifecycle. The 'aha' moment. Keep it short, no CTA.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-TE · lifecycle · email · Trial ending · day 12
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-TE', 'lifecycle', 'Trial ending · day 12', 'email',
  $subj$48 hours left on your trial.$subj$,
  $body${{first_name}},

Your trial ends {{trial_end_date}}. Two days from now.

In the 12 days so far: {{leads_received}} leads came in, {{leads_replied}} replied, {{tours_booked}} tours got booked. Median first-reply time: {{median_latency}} seconds.

No auto-charge when the trial ends. If you do nothing, you drop to the free tier (25 leads a month, email only) and keep everything you've built so far.

If you want to keep the SMS side of things — which is roughly where the speed comes from — Pro is $49 a month, cancel anytime. {{upgrade_url}}

Either way, thanks for the trial.

— The LeadSmart team$body$,
  'en',
  null,
  '["first_name", "trial_end_date", "leads_received", "leads_replied", "tours_booked", "median_latency", "upgrade_url"]'::jsonb,
  '{"type": "date_before_trial_end", "hours_before": 48, "requires": "leads_replied_count >= 1"}'::jsonb,
  $note$No urgency theater. Honest admission about the free-tier fallback.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-CR · lifecycle · email · Churn recovery · cancel + 30 days
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-CR', 'lifecycle', 'Churn recovery · cancel + 30 days', 'email',
  $subj$Quick one — was it us?$subj$,
  $body${{first_name}},

You cancelled LeadSmart a month ago. Hope things are going well.

I'm not writing to ask you back. I'm writing to ask what we did wrong — honestly, no marketing angle.

Was it the price? The integrations? Did the AI sound off in your voice? Something broke? Did you hire someone?

If you have thirty seconds, reply with a sentence. I read these myself.

— {{founder_first_name}}, founder$body$,
  'en',
  null,
  '["first_name", "founder_first_name"]'::jsonb,
  '{"type": "date_after_cancellation", "days_after": 30, "frequency": "once", "signed_by": "founder"}'::jsonb,
  $note$Only email signed by a named person. Must actually be from the founder. Must actually be read.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-RA · lifecycle · email · Reactivation · cancel + 90 days
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-RA', 'lifecycle', 'Reactivation · cancel + 90 days', 'email',
  $subj$What changed in the last 90 days.$subj$,
  $body${{first_name}},

Three months since you left. A few things are different:

— Native integration with Follow Up Boss (no more Zapier for FUB users).

— Median first-reply time is down to {{current_median_latency}} seconds (was {{old_median_latency}} when you had the trial).

— Home-anniversary and past-client messaging is live. That's the piece a lot of agents left looking for.

If any of that lands, the door's open — same account, same settings. {{reactivate_url}}

If not, no worries. Best of luck out there.

— The LeadSmart team$body$,
  'en',
  null,
  '["first_name", "current_median_latency", "old_median_latency", "reactivate_url"]'::jsonb,
  '{"type": "date_after_cancellation", "days_after": 90, "frequency": "once", "suppress_if": "replied_to=LC-CR"}'::jsonb,
  $note$Only mention features that actually exist. Never bluff.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LR-TINT · lead_response · sms · Listing interest · tour qualifier
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-TINT', 'lead_response', 'Listing interest · tour qualifier', 'sms',
  null,
  $body$Saw you pulled up {{property_address}}, {{first_name}}. Weekend walkthrough, mid-week, or neither? If neither, I can send two or three in {{area}} that might fit better — tell me what you liked about this one and I'll filter for it.$body$,
  'en',
  null,
  '["first_name", "property_address", "area"]'::jsonb,
  '{"type": "event", "event": "listing_page_request_info", "requires": ["consent_sms=true"]}'::jsonb,
  $note$Binary (weekend/mid-week) + optional pivot. Mirrors LR-Z01's structure but for a request-info click rather than a Zillow inbound.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-TR · lead_response · email · Tour recap · 2h post-tour
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-TR', 'lead_response', 'Tour recap · 2h post-tour', 'email',
  $subj${{property_short_address}} — thoughts?$subj$,
  $body${{first_name}},

Thanks for the tour today. When you've had a minute, tell me what stuck and what didn't — specific reactions are more useful to me than a pro/con list.

If it's a maybe, I can pull {{neighborhood}} comps from the last 90 days and draft an offer range with contingencies. No commitment — just the numbers so you can decide.

If it's a pass, fair enough. I'll re-filter based on what you reacted to today and send two or three closer to what you're actually after.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "property_short_address", "neighborhood", "agent_first_name"]'::jsonb,
  '{"type": "time_offset", "after_event": "tour_end", "offset_minutes": 120}'::jsonb,
  $note$'Specific reactions are more useful than a pro/con list' invites a real conversation rather than a polite summary.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-OS · lead_response · sms · Offer submitted
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-OS', 'lead_response', 'Offer submitted', 'sms',
  null,
  $body$Offer's in with the listing agent, {{first_name}}. Response deadline is {{response_deadline}}. I'll text the second we hear back — nothing for you to do in the meantime. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "response_deadline", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "offer_submitted"}'::jsonb,
  $note$'Nothing for you to do in the meantime' is load-bearing — waiting on offer response is the single most anxious period in a deal.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-OA · lead_response · sms · Offer accepted
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-OA', 'lead_response', 'Offer accepted', 'sms',
  null,
  $body$They accepted, {{first_name}}. {{property_short_address}} heads into escrow. Step-by-step in your inbox tonight. Nice work holding your number. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "property_short_address", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "offer_accepted"}'::jsonb,
  $note$'Holding your number' acknowledges negotiating discipline without hyperbole. Short intentionally — celebration + bridge to the detail email.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-CC · lead_response · email · Closing confirmed
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-CC', 'lead_response', 'Closing confirmed', 'email',
  $subj$Closing set — {{property_short_address}}, {{closing_date_short}}$subj$,
  $body${{first_name}},

We're closing {{property_short_address}} on {{closing_date_short}} at {{closing_time}}.

Bring to the signing table:
— government-issued photo ID (passport or driver's license)
— wire-transfer confirmation receipt
— final title insurance documents (I'll forward these 48 hours ahead)

If you want me there with you — say the word. Otherwise, keep your phone on and I'll let you know the second keys are ready.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "property_short_address", "closing_date_short", "closing_time", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "closing_date_set"}'::jsonb,
  $note$Checklist format avoids the emotional pressure of closing day. Offering to be there in person is the most valuable thing a good agent does at this stage.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- BD-01 · sphere · sms · Birthday
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'BD-01', 'sphere', 'Birthday', 'sms',
  null,
  $body$Happy birthday, {{first_name}}. Hope today's a good one. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "date_of_birth", "time_local": "09:00", "frequency": "yearly", "requires": ["date_of_birth != null"]}'::jsonb,
  $note$Deliberately short. Anything longer reads as a birthday wish dressed up like a sales touch.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- RA-01E · sphere · email · Referral thank-you · email variant
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'RA-01E', 'sphere', 'Referral thank-you · email variant', 'email',
  $subj$Thanks for sending {{referral_name}}.$subj$,
  $body${{first_name}},

{{referral_name}} reached out because of you. That means more than you probably realize.

I'll take care of them the way I took care of you. When the deal closes — if they're okay with me telling you — you'll hear from me.

Thank you.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "referral_name", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "referral_inbound", "paired_with": "RA-01"}'::jsonb,
  $note$Email variant of RA-01 for agents whose referring clients prefer email. 'If they're okay with me telling you' respects referral-confidentiality norms without being legalistic.$note$,
  'review', 'invented'
) on conflict (id) do nothing;


-- FILE: 20260483100000_seed_zh_templates.sql

-- Seed: 15 canonical Chinese (zh) drip templates.
--
-- Content drafted by Claude, native-speaker-reviewed by @yemfan
-- (see conversation 2026-04-21). Every entry is idempotent via
-- ON CONFLICT DO NOTHING so re-runs and partial rollbacks are safe.
--
-- Convention for this seed:
--   * `language` = 'zh' (Simplified Chinese, mainland conventions)
--   * `variant_of` = NULL — English canonical parents aren't seeded in
--     this repo yet, so these ship as standalone zh parents. When
--     English parents land, a follow-up migration sets `variant_of`
--     on each row to the corresponding en id. Template lookup code
--     already handles both the parent-only and parent+variant shapes
--     (see lib/locales/templateLookup.ts).
--   * `source` = 'invented' — flags that these are drafted copy that
--     should be reviewed + iterated against live agent data, not
--     content from an authoritative spec.
--   * `default_status` = 'review' for EVERY template. Even birthday +
--     holiday messages are review-gated on first ship so agents opt
--     in per-template. Product can upgrade individual templates to
--     'autosend' once a pilot agent validates tone.
--   * Placeholder convention: {{lead_name}}, {{agent_name}},
--     {{property_address}}, {{tour_time}}, {{closing_date}},
--     {{market_city}}, {{median_price}}, {{median_dom}},
--     {{yoy_change}}, {{low_estimate}}, {{high_estimate}}.
--     Downstream renderer prefers "<surname>先生/女士" form for
--     {{lead_name}} when gender is known, falls through to the raw
--     name string otherwise.
--   * SMS templates are kept ≤70 Chinese chars where possible so
--     each message is one UCS-2 segment on Twilio ($0.0075 vs the
--     $0.0150 of 2-segment sends).
--   * English terms kept inline when that's what bilingual US agents
--     actually say to mainland-origin clients: `offer`, `escrow`,
--     `close`, `CMA`, `Wire transfer`, `Title insurance`. Descriptive
--     terms translated: `refinance` → 重新贷款,
--     `Comparative Market Analysis` → 比较市场分析.

-- ── lead_response ─────────────────────────────────────────────────────

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_first_response_sms',
  'lead_response',
  '首次回复 · 新咨询',
  'sms',
  null,
  $t$您好{{lead_name}}！感谢您的咨询。请问您目前是在考虑买房、卖房，还是想先了解一下市场？我很乐意为您提供帮助。$t$,
  'zh',
  null,
  '["lead_name"]'::jsonb,
  'review',
  'invented',
  'Sent within the first minute of a new inbound lead. Formal 您 register; open-ended qualifier question.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_first_response_email',
  'lead_response',
  '首次回复 · 新咨询 (邮件)',
  'email',
  $t$感谢您咨询{{market_city}}房产$t$,
  $t$您好{{lead_name}}，

感谢您的咨询。我是{{agent_name}}，{{market_city}}地区的房产经纪人。

请问您目前主要在考虑哪类房产？例如：
• 自住房（首套 / 换房）
• 投资房
• 暂时只是了解市场行情

方便的话也请告诉我您的预算区间和心仪的区域，我可以为您筛选合适的房源，或者安排时间电话沟通。

期待您的回复。

{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "market_city", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Longer-form counterpart to zh_lead_first_response_sms. Same timing window; used when lead came in via email rather than SMS.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_followup_24h_sms',
  'lead_response',
  '24 小时未回复跟进',
  'sms',
  null,
  $t$您好{{lead_name}}，我是{{agent_name}}。不知您是否看到昨天我的消息？如果现在不方便，随时联系我都可以。$t$,
  'zh',
  null,
  '["lead_name", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Sent ~24h after zh_lead_first_response_sms if no inbound reply. Deliberately low-pressure — no hard question.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_followup_48h_email',
  'lead_response',
  '48 小时未回复跟进 (邮件)',
  'email',
  $t$还有什么我可以帮到您的吗？$t$,
  $t$您好{{lead_name}}，

想简单再跟进一下——如果您暂时不方便深聊，完全没关系。我把自己当成一个可以随时问问题的资源：不管是想大致了解{{market_city}}近期的成交价位，还是某个具体街区、学区、通勤情况，都可以直接问我，不需要承诺任何后续动作。

如果您已经不再考虑，也可以回复我一声，我就不再打扰您。

祝好，
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "market_city", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Second-touch follow-up at ~48h. Offers a graceful opt-out in the last paragraph so leads who never intended to engage can close the loop without guilt.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_tour_interest_qualifier_sms',
  'lead_response',
  '看房意向确认',
  'sms',
  null,
  $t$您好{{lead_name}}，看到您对 {{property_address}} 感兴趣。方便的话我这周可以安排带您实地看看。您哪天方便？$t$,
  'zh',
  null,
  '["lead_name", "property_address"]'::jsonb,
  'review',
  'invented',
  'Triggered by a "request info" click on a specific listing. Moves the thread from "abstract interest" to "scheduled tour".'
)
on conflict (id) do nothing;

-- ── lifecycle ─────────────────────────────────────────────────────────

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_tour_confirmation_sms',
  'lifecycle',
  '看房前 24 小时确认',
  'sms',
  null,
  $t$您好{{lead_name}}，明天 {{tour_time}} 在 {{property_address}} 看房，约定不变。到时见！—{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "tour_time", "property_address", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Day-before tour reminder. Low-pressure — confirms the appointment without asking for a reply. Safe candidate for autosend once piloted.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_tour_recap_email',
  'lifecycle',
  '看房后跟进 (邮件)',
  'email',
  $t${{property_address}} 看房后续$t$,
  $t$您好{{lead_name}}，

感谢您今天抽时间一起去看 {{property_address}}。方便的话可以跟我说说实际感受——哪些方面符合预期、哪些不太合适。

如果这套房子让您觉得值得继续推进，我可以帮您：
• 准备一份这个区域近期的可比成交分析
• 起草 offer，包括合理的出价区间和条件

如果这套不合适也没关系，我根据您今天的反馈再帮您筛选几套更贴近需求的。

期待您的消息。

{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "property_address", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Sent ~2h after a tour ends. Offers two forks: continue with this property (CMA + offer prep) or pivot (new listings). Low-pressure either way.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_offer_submitted_sms',
  'lifecycle',
  'Offer 已提交',
  'sms',
  null,
  $t$您好{{lead_name}}，您的 offer 已经正式提交给卖方经纪。有任何回复我会第一时间通知您。$t$,
  'zh',
  null,
  '["lead_name"]'::jsonb,
  'review',
  'invented',
  'Sent immediately after the offer package is submitted to the listing agent. Uses the English word "offer" because that is how mainland-origin US buyers actually refer to it.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_offer_accepted_sms',
  'lifecycle',
  'Offer 接受',
  'sms',
  null,
  $t$恭喜{{lead_name}}！您的 offer 已被接受，{{property_address}} 即将进入 escrow。接下来的步骤我稍后发邮件详细说明。$t$,
  'zh',
  null,
  '["lead_name", "property_address"]'::jsonb,
  'review',
  'invented',
  'Celebration + bridge to the next step. Deliberately defers detail to a follow-up email so the SMS stays short (1 UCS-2 segment).'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_closing_confirmed_email',
  'lifecycle',
  '交易即将完成 (邮件)',
  'email',
  $t$恭喜——{{property_address}} 交易即将完成$t$,
  $t${{lead_name}}，

正式恭喜您！{{property_address}} 的交易定于 {{closing_date}} 正式 close。

交割前您需要准备的几样材料：
• 政府签发的身份证明（护照或驾照）
• Wire transfer 的确认函
• Title insurance（产权保险）的最终文件

如果您有任何问题或需要我陪同办理，随时联系我。

祝贺！
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "property_address", "closing_date", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Sent when the closing date is confirmed. Keeps transaction-critical anglicisms (close / Wire transfer / Title insurance) because the real documents use them.'
)
on conflict (id) do nothing;

-- ── sphere ────────────────────────────────────────────────────────────

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_birthday_sms',
  'sphere',
  '生日祝福',
  'sms',
  null,
  $t${{lead_name}}，祝您生日快乐，身体健康，万事顺心！—{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Birthday wish for contacts with a known DOB. Intentionally short + non-transactional.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_chinese_new_year_sms',
  'sphere',
  '新春祝福',
  'sms',
  null,
  $t${{lead_name}}，新春快乐！祝您和家人在新的一年身体健康，万事如意。—{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Chinese New Year. Intentionally generic (no zodiac year) so the template does not need annual rewrites. Zodiac-year variants can live as one-off messages per cycle if product wants.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_quarterly_market_checkin_email',
  'sphere',
  '季度市场简报 (邮件)',
  'email',
  $t${{market_city}} 本季度房产市场简报$t$,
  $t$您好{{lead_name}}，

简单跟您更新一下{{market_city}}本季度的市场情况：
• 成交中位价：{{median_price}} 美元
• 平均在售天数：{{median_dom}} 天
• 与去年同期对比：{{yoy_change}}

这些只是大方向参考，具体到您关心的区域或价位段，情况可能会有不同。如果需要更细的数据或者针对某处房产分析，随时告诉我。

祝好，
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "market_city", "median_price", "median_dom", "yoy_change", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Quarterly data-forward touch for sphere contacts. Values come from the market-report pipeline.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_annual_home_value_update_email',
  'sphere',
  '年度房屋估值更新 (邮件)',
  'email',
  $t${{property_address}} 的最新估值（年度更新）$t$,
  $t$您好{{lead_name}}，

距离您购入 {{property_address}} 已经一年了。根据{{market_city}}近期的成交数据，这套房子目前的估值区间大约在 {{low_estimate}}–{{high_estimate}} 美元。

说明一下：
• 这只是基于近期可比成交的参考估值，不等于市场挂牌价
• 实际价格还要看房屋目前的状况、装修和具体街区细节
• 如果您希望了解更精准的数字（比如考虑换房、重新贷款 或者纯粹好奇），我可以帮您做一份正式的 CMA（比较市场分析）

另外，如果您身边有朋友也在考虑买房或卖房，随时可以让他们直接联系我。

祝您一切顺利，
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "property_address", "market_city", "low_estimate", "high_estimate", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Past-client anniversary touch. Notes: (1) "refinance" translated to 重新贷款 per native-speaker review; (2) "CMA (Comparative Market Analysis)" expanded as "CMA (比较市场分析)" for clarity.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_referral_ask_email',
  'sphere',
  '转介绍请求 (邮件)',
  'email',
  $t$一点小请求$t$,
  $t$您好{{lead_name}}，

希望您入住 {{property_address}} 一切顺利。

有一个小请求——如果您身边的朋友、同事或家人也在考虑买房或卖房，希望您能把我推荐给他们。我绝不会打扰或纠缠您的朋友；只有在他们主动联系我时才会跟进。

如果您愿意，也可以直接把这封邮件或者微信转发给他们，让他们回复即可。

无论如何，再次感谢您给我机会帮您完成这次交易。

诚挚感谢，
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "property_address", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Referral ask ~30 days post-closing. Intentionally soft per native-speaker note: "I will not pursue your friends uninvited." Mentions WeChat as a forwarding channel (per review 2026-04-21).'
)
on conflict (id) do nothing;


-- FILE: 20260483100000_seed_zh_variants.sql

-- Seed: 22 Simplified-Chinese (zh) template variants + 1 zh-standalone.
--
-- Each variant:
--   * has `variant_of` pointing at the English canonical in
--     20260483050000_seed_en_canonicals.sql (runs earlier by filename
--     prefix, so parents exist when variants insert)
--   * uses the canonical placeholder names verbatim ({{first_name}},
--     {{street_name}}, {{agent_first_name}}, etc.)
--   * inherits the parent's trigger_config so both language versions
--     fire on the same event; renderer picks variant vs parent via
--     lib/locales/templateLookup.ts + the lead's preferred_language
--   * ships at default_status='review' regardless of parent's status —
--     bilingual agents opt in per-template during pilot.
--
-- Content written by Claude, native-speaker-reviewed by @yemfan
-- (conversation 2026-04-21). Follows the outbound tone directive in
-- lib/locales/registry.ts: formal 您 register, mainland conventions,
-- no investment-guarantee / FOMO phrasing, Arabic digits, 美元 for USD,
-- transaction-critical anglicisms preserved (offer, escrow, close,
-- CMA, Wire transfer, Title insurance), descriptive terms translated
-- (refinance -> 重新贷款, Comparative Market Analysis -> 比较市场分析).
--
-- Not translated (stays English only): the 5 LC-* subscription-lifecycle
-- templates. Those are LeadSmart-the-product emailing the agent, not the
-- agent messaging their leads, so they stay in the dashboard's UI
-- language (currently English-only until zh.ui.enabled flips in a later
-- PR with 100% message-catalog coverage).

-- variant of HA-01 · sphere · sms · Home anniversary
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_ha_01', 'sphere', 'Home anniversary · 简体中文', 'sms',
  null,
  $body$嘿{{first_name}}——不知不觉，{{street_name}} 签约已经 {{years}} 年了。希望您依然住得舒心。这套房目前估值大约 {{avm_display}}（比当初购入高出 {{delta_display}}）。哪天想让我帮您更深入看一下，说一声就行。—{{agent_first_name}}$body$,
  'zh',
  'HA-01',
  '["first_name", "years", "s", "street_name", "avm_display", "delta_display", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "closing_date", "time_local": "09:00", "frequency": "yearly", "requires": ["anniversary_opt_in=true", "relationship_type in [past_buyer_client, past_seller_client]"]}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of HA-01E · sphere · email · Home anniversary · email variant
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_ha_01e', 'sphere', 'Home anniversary · email variant · 简体中文', 'email',
  $subj${{street_name}} 入住满 {{years}} 年$subj$,
  $body$您好{{first_name}}，

{{years}} 年了。我还记得当年跟卖方在 inspection 上反复磋商的那晚——您处理得比我认识的大多数经纪都沉稳。

您在 {{street_name}} 的这套房子目前估值大约 {{avm_display}}——比购入价高出 {{delta_display}}。不是说您要卖，只是让您心里有数。

哪天想让我帮您拉 comps，或者看看重新贷款能带来什么变化，一条短信的事。不然就好好享受您的家。

—{{agent_first_name}}$body$,
  'zh',
  'HA-01E',
  '["first_name", "years", "s", "street_name", "avm_display", "delta_display", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "closing_date", "paired_with": "HA-01", "condition": "contact has email_on_file=true"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of EQ-01 · sphere · email · Quarterly equity update
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_eq_01', 'sphere', 'Quarterly equity update · 简体中文', 'email',
  $subj${{neighborhood}} {{quarter}} 房产快照$subj$,
  $body${{first_name}}，

简单给您一个季度快照——关于您 {{street_name}} 的房子。

购入时间 {{closing_date_short}}，购入价 {{closing_price_display}}。目前估值 {{avm_display}}——比购入价高 {{delta_pct}}%，约 {{delta_display}} 的 equity。

{{neighborhood}} 本季度值得留意的两点：成交中位价 {{median_price}}，在售天数 {{dom_change_phrase}}（相对上季度）。

如果您想知道这些数据对您的重新贷款、出租或出售计划意味着什么，回复即可。不是推销，真的。

—{{agent_first_name}}$body$,
  'zh',
  'EQ-01',
  '["first_name", "street_name", "closing_date_short", "closing_price_display", "avm_display", "delta_pct", "delta_display", "quarter", "neighborhood", "median_price", "dom_change_phrase", "agent_first_name"]'::jsonb,
  '{"type": "calendar_quarter_start", "requires": ["relationship_type in [past_buyer_client, past_seller_client]", "agent_of_record_match=true"]}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of EM-01 · sphere · sms · Equity milestone · crossed +25%
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_em_01', 'sphere', 'Equity milestone · crossed +25% · 简体中文', 'sms',
  null,
  $body$小提醒，{{first_name}}——您 {{street_name}} 的房子刚越过 25% 升值线，目前估值约 {{avm_display}}。不是说您需要做什么，只是让您知道一下。—{{agent_first_name}}$body$,
  'zh',
  'EM-01',
  '["first_name", "street_name", "avm_display", "agent_first_name"]'::jsonb,
  '{"type": "threshold_crossed", "field": "equity_pct", "threshold": 0.25, "direction": "upward", "frequency": "once_per_milestone"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of EM-02 · sphere · sms · Equity milestone · crossed +50%
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_em_02', 'sphere', 'Equity milestone · crossed +50% · 简体中文', 'sms',
  null,
  $body${{first_name}}，里程碑时刻：您 {{closing_year}} 年买的 {{street_name}} 刚突破 50% 升值。目前估值约 {{avm_display}}。恭喜——眼光不错。如果想聊聊这意味着什么，我一直在。—{{agent_first_name}}$body$,
  'zh',
  'EM-02',
  '["first_name", "street_name", "closing_year", "avm_display", "agent_first_name"]'::jsonb,
  '{"type": "threshold_crossed", "field": "equity_pct", "threshold": 0.5, "direction": "upward", "frequency": "once_per_milestone"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of DR-01 · sphere · sms · Dormant re-engage
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_dr_01', 'sphere', 'Dormant re-engage · 简体中文', 'sms',
  null,
  $body$嘿{{first_name}}，好久没联络了。近况如何？您身边有朋友在考虑{{season}}搬家吗？没有压力——只是在整理名单。—{{agent_first_name}}$body$,
  'zh',
  'DR-01',
  '["first_name", "agent_first_name", "season"]'::jsonb,
  '{"type": "dormancy", "field": "last_touch_date", "threshold_days": 120, "frequency": "once", "suppress_if": "any_signal_fired_within_30_days"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of RA-01 · sphere · sms · Referral thank-you
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_ra_01', 'sphere', 'Referral thank-you · 简体中文', 'sms',
  null,
  $body${{first_name}}——{{referral_name}} 刚因为您主动联系了我。这份信任意义重大，我会用心对待他们。谢谢您。—{{agent_first_name}}$body$,
  'zh',
  'RA-01',
  '["first_name", "referral_name", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "new_lead_cites_this_contact_as_referrer", "latency_max_hours": 2}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of JS-01 · sphere · sms · Just sold in your neighborhood
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_js_01', 'sphere', 'Just sold in your neighborhood · 简体中文', 'sms',
  null,
  $body${{first_name}}——{{address_short}} 刚以 {{sold_price}} 成交，离您家就两栋房子。这对您街区的 comps 可能有影响，想着您会想知道。—{{agent_first_name}}$body$,
  'zh',
  'JS-01',
  '["first_name", "address_short", "sold_price", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "comparable_sale_within_half_mile", "requires": ["same_zip", "sq_ft_within_15pct"], "frequency_cap": "1_per_90_days_per_contact"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of BD-01 · sphere · sms · Birthday
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_bd_01', 'sphere', 'Birthday · 简体中文', 'sms',
  null,
  $body${{first_name}}，生日快乐！希望今天过得开心。—{{agent_first_name}}$body$,
  'zh',
  'BD-01',
  '["first_name", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "date_of_birth", "time_local": "09:00", "frequency": "yearly", "requires": ["date_of_birth != null"]}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of RA-01E · sphere · email · Referral thank-you · email variant
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_ra_01e', 'sphere', 'Referral thank-you · email variant · 简体中文', 'email',
  $subj$感谢您把 {{referral_name}} 介绍给我$subj$,
  $body${{first_name}}，

{{referral_name}} 刚因为您主动联系了我。这份信任可能比您意识到的还要珍贵。

我会像当年照顾您一样照顾他们。交易完成之后——如果他们同意我告诉您——我会让您知道。

谢谢。

—{{agent_first_name}}$body$,
  'zh',
  'RA-01E',
  '["first_name", "referral_name", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "referral_inbound", "paired_with": "RA-01"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-Z01 · lead_response · sms · Zillow buyer inquiry · first touch
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_z01', 'lead_response', 'Zillow buyer inquiry · first touch · 简体中文', 'sms',
  null,
  $body$您好{{first_name}}，我是{{brokerage}}的{{agent_first_name}}——看到您咨询了 {{property_address}}。您是希望这个周末看房，还是目前先收集信息？$body$,
  'zh',
  'LR-Z01',
  '["first_name", "agent_first_name", "brokerage", "property_address"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_buyer", "latency_max_seconds": 60}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-Z02 · lead_response · email · Zillow buyer inquiry · first touch · email
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_z02', 'lead_response', 'Zillow buyer inquiry · first touch · email · 简体中文', 'email',
  $subj$关于 {{property_short_address}}$subj$,
  $body$您好{{first_name}}，

看到您咨询了 {{property_address}}——位置不错。如果我没记错挂牌信息的话，三卧、{{bathrooms}} 浴、{{square_footage}} 平方英尺。

一个快速问题，方便我更有针对性：您是想这个周末看房，还是还在前期了解阶段？不管哪种，我都可以给您发 2–3 套 {{neighborhood}} 附近类似的房源——其中有几套目前还没挂上 Zillow。

如果发短信比邮件方便，我的号码 {{agent_phone}}。期待回复。

—{{agent_first_name}}$body$,
  'zh',
  'LR-Z02',
  '["first_name", "property_address", "property_short_address", "bathrooms", "square_footage", "neighborhood", "agent_phone", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_buyer", "paired_with": "LR-Z01", "delay_after_sms_seconds": 120}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-Z03 · lead_response · sms · Zillow seller inquiry · first touch
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_z03', 'lead_response', 'Zillow seller inquiry · first touch · 简体中文', 'sms',
  null,
  $body$您好{{first_name}}，我是{{brokerage}}的{{agent_first_name}}。看到您查询了 {{address}} 的估值。我可以给您出一份正式的 CMA（比较市场分析）——比 Zestimate 精确得多。您是近期考虑出售，还是先看看数字？$body$,
  'zh',
  'LR-Z03',
  '["first_name", "agent_first_name", "brokerage", "address"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_seller", "latency_max_seconds": 60}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-OH01 · lead_response · sms · Open-house sign-in · follow-up
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_oh01', 'lead_response', 'Open-house sign-in · follow-up · 简体中文', 'sms',
  null,
  $body$嘿{{first_name}}——我是今天下午 {{property_address}} open house 见过的{{agent_first_name}}。谢谢您过来看看。感觉如何？是在认真考虑，还是顺便看看？$body$,
  'zh',
  'LR-OH01',
  '["first_name", "agent_first_name", "property_address"]'::jsonb,
  '{"type": "event", "event": "open_house_sign_in", "delay_hours": 3, "condition": "after_open_house_end"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-NR01 · lead_response · sms · No-reply follow-up · day 2
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_nr01', 'lead_response', 'No-reply follow-up · day 2 · 简体中文', 'sms',
  null,
  $body$嘿{{first_name}}——简短的：今天 {{neighborhood}} 新挂了几套 {{price_max}} 以下的房源。要不要我把清单发给您？（其实就那么几套。）$body$,
  'zh',
  'LR-NR01',
  '["first_name", "neighborhood", "price_max"]'::jsonb,
  '{"type": "inactivity", "reference": "first_touch_sent", "threshold_hours": {"min": 36, "max": 48}, "frequency": "once", "requires": "agent_has_new_listings_in_neighborhood=true"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-NR02 · lead_response · sms · No-reply follow-up · day 7 · opt-out
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_nr02', 'lead_response', 'No-reply follow-up · day 7 · opt-out · 简体中文', 'sms',
  null,
  $body$这是我最后一次跟进，{{first_name}}——如果 {{neighborhood}} 不对、或者时机不合适，完全没问题，我就不再发信息了。如果您希望我帮您留意某种具体的房源，告诉我大致方向，我会替您盯着。$body$,
  'zh',
  'LR-NR02',
  '["first_name", "neighborhood"]'::jsonb,
  '{"type": "inactivity", "reference": "first_touch_sent", "threshold_days": 7, "frequency": "once", "next_state": "slow_drip"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-TOUR · lead_response · sms · Tour confirmation
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_tour', 'lead_response', 'Tour confirmation · 简体中文', 'sms',
  null,
  $body$约定好了，{{first_name}}：{{tour_day}} {{tour_time}}，{{property_address}} 门口见。我开一辆 {{agent_car}}，您可以在街边随便停。有任何变动随时短信告诉我。—{{agent_first_name}}$body$,
  'zh',
  'LR-TOUR',
  '["first_name", "tour_day", "tour_time", "property_address", "agent_car", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "tour_scheduled", "latency_max_seconds": 30}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-TINT · lead_response · sms · Listing interest · tour qualifier
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_tint', 'lead_response', 'Listing interest · tour qualifier · 简体中文', 'sms',
  null,
  $body$看到您关注 {{property_address}}，{{first_name}}。周末实地看看，还是工作日更方便？都不行也没关系——告诉我这套您喜欢什么，我可以发 2–3 套 {{area}} 附近更贴近的。$body$,
  'zh',
  'LR-TINT',
  '["first_name", "property_address", "area"]'::jsonb,
  '{"type": "event", "event": "listing_page_request_info", "requires": ["consent_sms=true"]}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-TR · lead_response · email · Tour recap · 2h post-tour
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_tr', 'lead_response', 'Tour recap · 2h post-tour · 简体中文', 'email',
  $subj${{property_short_address}} 感觉如何？$subj$,
  $body${{first_name}}，

感谢您今天一起看房。方便的时候跟我说说感受——具体反应比一二三罗列的优缺点对我更有用。

如果还在考虑这一套，我可以拉 {{neighborhood}} 近 90 天的 comps，起草一份 offer 报价区间和条件。不代表要提交——只是让您看到实际数字再决定。

如果这套不合适也没关系。我根据您今天的反应再筛 2–3 套更贴近的发您。

—{{agent_first_name}}$body$,
  'zh',
  'LR-TR',
  '["first_name", "property_short_address", "neighborhood", "agent_first_name"]'::jsonb,
  '{"type": "time_offset", "after_event": "tour_end", "offset_minutes": 120}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-OS · lead_response · sms · Offer submitted
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_os', 'lead_response', 'Offer submitted · 简体中文', 'sms',
  null,
  $body$Offer 已正式提交给卖方经纪，{{first_name}}。对方需在 {{response_deadline}} 前回复。有任何消息我会第一时间告诉您——中间您什么都不用做。—{{agent_first_name}}$body$,
  'zh',
  'LR-OS',
  '["first_name", "response_deadline", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "offer_submitted"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-OA · lead_response · sms · Offer accepted
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_oa', 'lead_response', 'Offer accepted · 简体中文', 'sms',
  null,
  $body$对方接受了，{{first_name}}。{{property_short_address}} 正式进入 escrow。今晚会发邮件详细说明步骤。出价守得漂亮。—{{agent_first_name}}$body$,
  'zh',
  'LR-OA',
  '["first_name", "property_short_address", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "offer_accepted"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-CC · lead_response · email · Closing confirmed
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_cc', 'lead_response', 'Closing confirmed · 简体中文', 'email',
  $subj$交易确认——{{property_short_address}}，{{closing_date_short}}$subj$,
  $body${{first_name}}，

我们定了：{{closing_date_short}} {{closing_time}}，{{property_short_address}} 完成交割。

签署时请准备：
— 政府签发的身份证件（护照或驾照）
— Wire transfer 的确认回执
— Title insurance（产权保险）最终文件（我会在 48 小时前转发给您）

如果您希望我陪同办理，随时告诉我。否则保持手机通畅，钥匙交接我第一时间联系您。

—{{agent_first_name}}$body$,
  'zh',
  'LR-CC',
  '["first_name", "property_short_address", "closing_date_short", "closing_time", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "closing_date_set"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- Standalone Chinese New Year greeting (no English canonical).
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_sphere_chinese_new_year_sms', 'sphere', '新春祝福 · 简体中文', 'sms',
  null,
  $body${{first_name}}，新春快乐！祝您和家人在新的一年身体健康，万事如意。—{{agent_first_name}}$body$,
  'zh', null,
  '["first_name", "agent_first_name"]'::jsonb,
  '{"type": "date_fixed", "lunar_calendar": "cny_day_1", "time_local": "09:00", "frequency": "yearly"}'::jsonb,
  $note$Culturally specific — no English parent by design. Generic zodiac-agnostic wording so it does not need annual rewrites. Only send to contacts with preferred_language='zh'.$note$,
  'review', 'invented'
) on conflict (id) do nothing;


-- FILE: 20260483200000_cleanup_stale_zh_templates.sql

-- Cleanup: remove the 15 rows seeded by the stale
-- 20260483100000_seed_zh_templates.sql migration.
--
-- Context: two migrations with the same 20260483100000 prefix landed on
-- main simultaneously —
--   * _seed_zh_templates.sql  (stale — non-canonical placeholders like
--                              {{lead_name}}, {{property_address}};
--                              standalone rows with variant_of = NULL;
--                              transaction milestones mis-categorized as
--                              `lifecycle` instead of `lead_response`)
--   * _seed_zh_variants.sql   (correct — canonical placeholders like
--                              {{first_name}}, {{street_name}}; variants
--                              keyed to English parents; proper category)
--
-- Alphabetical order runs _templates first, so the stale rows land first.
-- The correct _variants migration then inserts 22 non-colliding rows
-- successfully, but the one overlapping ID (`zh_sphere_chinese_new_year_sms`)
-- hits ON CONFLICT DO NOTHING — the stale version wins the race and the
-- canonical version is silently dropped.
--
-- This migration:
--   (1) deletes all 15 stale rows by id (idempotent — if a row is already
--       absent because the stale migration never ran, DELETE is a no-op);
--   (2) re-inserts the canonical `zh_sphere_chinese_new_year_sms` that
--       would otherwise be lost to the conflict above.
--
-- Why not just delete the stale migration file from main:
--   Supabase tracks applied migrations by filename in
--   `supabase_migrations.schema_migrations`. Removing a migration that
--   has been applied causes a "missing" complaint on the next `db push`.
--   Leaving the file + cleaning up via a later migration is the safer
--   operational shape — works whether the stale file already ran or not.

-- ── (1) delete stale rows ─────────────────────────────────────────────
delete from public.templates
where id in (
  'zh_lead_first_response_sms',
  'zh_lead_first_response_email',
  'zh_lead_followup_24h_sms',
  'zh_lead_followup_48h_email',
  'zh_lead_tour_interest_qualifier_sms',
  'zh_lifecycle_tour_confirmation_sms',
  'zh_lifecycle_tour_recap_email',
  'zh_lifecycle_offer_submitted_sms',
  'zh_lifecycle_offer_accepted_sms',
  'zh_lifecycle_closing_confirmed_email',
  'zh_sphere_birthday_sms',
  'zh_sphere_chinese_new_year_sms',
  'zh_sphere_quarterly_market_checkin_email',
  'zh_sphere_annual_home_value_update_email',
  'zh_sphere_referral_ask_email'
);

-- ── (2) re-insert the canonical CNY ───────────────────────────────────
-- Identical row to the INSERT in 20260483100000_seed_zh_variants.sql —
-- needed because the DELETE above (or the earlier ON CONFLICT race) wipes
-- it out. ON CONFLICT DO NOTHING guards against the unlikely case where
-- the row already exists with the canonical content.
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_sphere_chinese_new_year_sms', 'sphere', '新春祝福 · 简体中文', 'sms',
  null,
  $body${{first_name}}，新春快乐！祝您和家人在新的一年身体健康，万事如意。—{{agent_first_name}}$body$,
  'zh', null,
  '["first_name", "agent_first_name"]'::jsonb,
  '{"type": "date_fixed", "lunar_calendar": "cny_day_1", "time_local": "09:00", "frequency": "yearly"}'::jsonb,
  $note$Culturally specific — no English parent by design. Generic zodiac-agnostic wording so it does not need annual rewrites. Only send to contacts with preferred_language='zh'.$note$,
  'review', 'invented'
) on conflict (id) do nothing;


-- FILE: 20260484000000_wechat_oa_groundwork.sql

-- WeChat Official Account (OA) integration — groundwork schema.
--
-- Three tables, all dormant until the JV-owned Service Account is
-- registered with Tencent and credentials land in env / the
-- `wechat_oa_accounts` row. The webhook route at
-- `app/api/wechat/callback/route.ts` reads from these tables and
-- refuses traffic unless a row exists + WECHAT_ENABLED=1.
--
-- Architectural notes:
--
-- * Single JV-owned OA is the realistic shape — Tencent Service Account
--   registration requires a Chinese business entity (营业执照), and
--   asking each US-based agent to register their own is impractical.
--   One `wechat_oa_accounts` row covers the whole fleet; agents appear
--   as senders inside the JV's OA via message-level branding (avatar,
--   name prefix).
--
-- * `wechat_user_links` maps a WeChat subscriber (openid) to the agent
--   whose QR they scanned (agent_id) and, when identifiable, to the
--   existing CRM contact record (contact_id). The QR code's `scene`
--   parameter carries the agent_id so we can route new subscribers
--   into the right agent's book.
--
-- * `wechat_messages` is the per-OA analogue of `sms_messages` and
--   `email_messages`. Keeping it separate (rather than overloading
--   the SMS table with a channel column) avoids forcing WeChat-specific
--   columns (msg_type, event_type, template_id, openid) onto the
--   existing SMS/email flows. A `channel` view can unify the three
--   later for the inbox without schema surgery.
--
-- * Signatures + secrets (WECHAT_APP_SECRET, WECHAT_ENCODING_AES_KEY)
--   do NOT live in this table — they come from env. Storing them in
--   the DB would expand the "if our DB leaks, the attacker can post
--   outbound WeChat messages as us" blast radius unnecessarily. The
--   public app_id + verification_token (which are webhook-path
--   knowledge anyway) are stored here for reference.

-- ── wechat_oa_accounts ──────────────────────────────────────────────
create table if not exists public.wechat_oa_accounts (
  id uuid primary key default gen_random_uuid(),
  /** Tencent-issued OA identifier, format "wxXXXXXXXXXXXXXXXX". */
  app_id text not null unique,
  /** Human-readable JV OA name for admin surfaces. */
  display_name text not null,
  /** Token the webhook shares with Tencent for signature verification.
      See /api/wechat/callback signature check. Stored here because it's
      not a secret per se — it travels with every webhook request and
      pairing the hash check against DB-side value supports rotation. */
  verification_token text not null,
  /** True once Tencent has approved the OA's webhook + primary capabilities. */
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wechat_oa_accounts is
  'Registered WeChat Official Accounts. Single JV-owned row is the '
  'typical shape; multi-row support lets a future tier sell dedicated '
  'OA hosting to brokerage customers without a second migration.';

-- ── wechat_user_links ───────────────────────────────────────────────
create table if not exists public.wechat_user_links (
  id uuid primary key default gen_random_uuid(),
  oa_account_id uuid not null references public.wechat_oa_accounts(id) on delete cascade,
  /** Tencent-issued opaque subscriber id, unique per (OA, user) pair. */
  openid text not null,
  /** When identified, the CRM contact this subscriber is. Kept nullable
      because first interaction may not yet include contact info. Use
      phone / email enrichment to backfill post-hoc. */
  contact_id uuid references public.contacts(id) on delete set null,
  /** Agent whose QR the subscriber scanned. Derived from the QR's
      `scene` parameter at subscribe time. Nullable for subscribers
      whose entry point we didn't capture (rare). */
  agent_id bigint references public.agents(id) on delete set null,
  /** First subscribe event. */
  subscribed_at timestamptz not null default now(),
  /** Null until they unsubscribe. Cleared if they re-subscribe. */
  unsubscribed_at timestamptz,
  /** Last inbound event, used for the 48-hour customer-service window. */
  last_interaction_at timestamptz,
  /** Raw `EventKey` / `Scene` from the QR scan (e.g. "agent_123"). */
  scene_qr_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (oa_account_id, openid)
);

create index if not exists idx_wechat_user_links_contact
  on public.wechat_user_links(contact_id)
  where contact_id is not null;
create index if not exists idx_wechat_user_links_agent
  on public.wechat_user_links(agent_id)
  where agent_id is not null;

comment on table public.wechat_user_links is
  'OA subscriber roster. One row per (OA, openid) pair. Populated on '
  'subscribe events from the Tencent webhook. Agents "own" subscribers '
  'whose scene QR routed to them at subscribe time.';
comment on column public.wechat_user_links.last_interaction_at is
  'Updated on every inbound message or event. The 48-hour customer-'
  'service-message window (Tencent rule) is measured from this value; '
  'after 48h of silence, we can only send pre-approved template '
  'messages to this subscriber.';

-- ── wechat_messages ─────────────────────────────────────────────────
create table if not exists public.wechat_messages (
  id uuid primary key default gen_random_uuid(),
  oa_account_id uuid not null references public.wechat_oa_accounts(id) on delete cascade,
  openid text not null,
  /** Denormalized from wechat_user_links at insert time so historical
      messages stay attributed even if the link row is later reassigned. */
  contact_id uuid references public.contacts(id) on delete set null,
  agent_id bigint references public.agents(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  /** Tencent message type: 'text', 'event', 'image', 'voice', 'video',
      'shortvideo', 'location', 'link'. For outbound: also 'template'
      (pre-approved template messages) and 'customer_service' (free-form
      replies within the 48h window). */
  msg_type text not null,
  /** When msg_type='event': Tencent event name, e.g. 'subscribe',
      'unsubscribe', 'SCAN', 'CLICK', 'VIEW'. */
  event_type text,
  /** Text body (for text messages) or caption (for media). */
  content text,
  /** Pre-approved template id (outbound template messages only). */
  template_id text,
  /** Tencent's MsgId for inbound messages; Tencent's msgid for
      outbound template messages. Indexed to dedupe webhook retries. */
  wechat_msg_id text,
  /** Full Tencent payload for debug/audit. Keep the raw XML parsed into
      a JSON object so future field additions don't need a migration. */
  raw_payload jsonb,
  status text not null default 'received'
    check (status in ('received', 'sent', 'failed', 'queued')),
  /** Failure detail when status='failed'. */
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wechat_messages_openid
  on public.wechat_messages(oa_account_id, openid, created_at desc);
create index if not exists idx_wechat_messages_contact
  on public.wechat_messages(contact_id, created_at desc)
  where contact_id is not null;
create unique index if not exists uniq_wechat_messages_tencent_msgid
  on public.wechat_messages(oa_account_id, wechat_msg_id)
  where wechat_msg_id is not null;

comment on table public.wechat_messages is
  'Per-OA WeChat message log. Separate from sms_messages / '
  'email_messages because WeChat has channel-specific fields '
  '(msg_type, event_type, openid, template_id) and conflating them '
  'onto sms_messages would force those columns onto every SMS row. A '
  'future "channel_messages" view can unify the three for the inbox UI '
  'without requiring a schema rewrite.';
comment on column public.wechat_messages.wechat_msg_id is
  'Tencent MsgId — unique per (OA, message). The partial unique index '
  'on (oa_account_id, wechat_msg_id) is how we dedupe the occasional '
  'Tencent webhook retry without needing app-level idempotency keys.';


-- FILE: 20260485000000_transaction_coordinator.sql

-- Transaction Coordinator — agent-facing tracker for active deals in the
-- closing-phase window (mutual acceptance through keys-in-hand).
--
-- Motivation:
--   A buyer-rep agent spends 30-50 hours per deal in the closing phase
--   coordinating inspection, appraisal, loan, disclosures, title, and
--   wire transfer. Almost none of that work generates new leads —
--   it's pure operational overhead. Today agents track it in texts +
--   spreadsheets + memory. This schema gives them a structured place
--   to run a deal.
--
--   The existing client-portal pipeline (lib/clientPortalPipeline.ts)
--   exposes 7 stages to the BUYER for status transparency. This
--   transaction schema is the AGENT-side operational layer underneath
--   those stages.
--
-- Three tables:
--   * `transactions`            — one row per deal
--   * `transaction_tasks`       — the per-deal checklist (seeded from
--                                 lib/transactions/seedTasks.ts on
--                                 transaction create)
--   * `transaction_counterparties` — title / lender / inspector /
--                                    insurance contacts for the deal
--
-- Design notes:
--
--   * `agent_id` column type is detected at migration time — some
--     environments use uuid, others bigint. Same pattern as
--     20260479100000_message_templates.sql so the migration runs
--     against both shapes.
--   * Dates default to NULL and are filled in as the deal progresses.
--     When `mutual_acceptance_date` is set, the service layer auto-
--     fills California-standard contingency deadlines (17 days for
--     inspection, 21 for loan, 30 for close) unless the agent
--     overrides.
--   * Listing-side transactions are supported via `transaction_type`
--     but MVP seed tasks cover buyer_rep only. Listing-side seed
--     template is a follow-up.
--   * `contacts.closing_date` and `closing_price` (already present
--     for past-client anniversary messaging) are independent. When
--     a transaction closes, a service-layer hook backfills those
--     columns so anniversary / equity-milestone templates continue
--     to fire. Keeping them denormalized is intentional — the
--     anniversary workflow shouldn't need to JOIN a transaction
--     table for the common case.

-- ── transactions ──────────────────────────────────────────────────────
do $$
declare
  v_agent_type text;
begin
  -- Detect agents.id type.
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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.transactions (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        -- Identity of the deal
        transaction_type text not null default 'buyer_rep'
          check (transaction_type in ('buyer_rep', 'listing_rep', 'dual')),
        property_address text not null,
        city text,
        state text,
        zip text,
        purchase_price numeric,

        -- Status lifecycle
        status text not null default 'active'
          check (status in ('active', 'closed', 'terminated', 'pending')),
        terminated_reason text,

        -- Key dates. `mutual_acceptance_date` is the anchor; other
        -- deadlines are auto-filled from it on create/update.
        mutual_acceptance_date date,
        inspection_deadline date,
        inspection_completed_at date,
        appraisal_deadline date,
        appraisal_completed_at date,
        loan_contingency_deadline date,
        loan_contingency_removed_at date,
        closing_date date,              -- scheduled
        closing_date_actual date,       -- when it actually happened

        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create table if not exists public.transaction_tasks (
        id uuid primary key default gen_random_uuid(),
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        stage text not null
          check (stage in ('contract', 'inspection', 'appraisal', 'loan', 'closing')),
        title text not null,
        description text,
        due_date date,
        completed_at timestamptz,
        completed_by uuid references public.agents(id) on delete set null,
        order_index integer not null default 0,
        -- Stable identifier for seeded tasks (e.g. 'open_escrow', 'schedule_inspection').
        -- NULL for agent-created custom tasks. Used to skip re-seeding when the
        -- task set on the seed file evolves.
        seed_key text,
        source text not null default 'seed'
          check (source in ('seed', 'custom')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create table if not exists public.transaction_counterparties (
        id uuid primary key default gen_random_uuid(),
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        role text not null
          check (role in ('title', 'lender', 'inspector', 'insurance', 'co_agent', 'other')),
        name text not null,
        company text,
        email text,
        phone text,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.transactions (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        transaction_type text not null default 'buyer_rep'
          check (transaction_type in ('buyer_rep', 'listing_rep', 'dual')),
        property_address text not null,
        city text,
        state text,
        zip text,
        purchase_price numeric,

        status text not null default 'active'
          check (status in ('active', 'closed', 'terminated', 'pending')),
        terminated_reason text,

        mutual_acceptance_date date,
        inspection_deadline date,
        inspection_completed_at date,
        appraisal_deadline date,
        appraisal_completed_at date,
        loan_contingency_deadline date,
        loan_contingency_removed_at date,
        closing_date date,
        closing_date_actual date,

        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create table if not exists public.transaction_tasks (
        id uuid primary key default gen_random_uuid(),
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        stage text not null
          check (stage in ('contract', 'inspection', 'appraisal', 'loan', 'closing')),
        title text not null,
        description text,
        due_date date,
        completed_at timestamptz,
        completed_by bigint references public.agents(id) on delete set null,
        order_index integer not null default 0,
        seed_key text,
        source text not null default 'seed'
          check (source in ('seed', 'custom')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create table if not exists public.transaction_counterparties (
        id uuid primary key default gen_random_uuid(),
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        role text not null
          check (role in ('title', 'lender', 'inspector', 'insurance', 'co_agent', 'other')),
        name text not null,
        company text,
        email text,
        phone text,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

-- ── Indexes (shared across both agent-id flavors) ────────────────────
create index if not exists idx_transactions_agent
  on public.transactions(agent_id, status, closing_date);
create index if not exists idx_transactions_contact
  on public.transactions(contact_id);
create index if not exists idx_transactions_closing_date
  on public.transactions(closing_date)
  where status = 'active';

create index if not exists idx_transaction_tasks_transaction
  on public.transaction_tasks(transaction_id, order_index);
create index if not exists idx_transaction_tasks_due
  on public.transaction_tasks(transaction_id, due_date)
  where completed_at is null;
create unique index if not exists uniq_transaction_tasks_seed_key
  on public.transaction_tasks(transaction_id, seed_key)
  where seed_key is not null;

create index if not exists idx_transaction_counterparties_transaction
  on public.transaction_counterparties(transaction_id);

-- ── Comments ──────────────────────────────────────────────────────────
comment on table public.transactions is
  'Agent-facing transaction record — one row per active or closed deal. '
  'Distinct from contacts.closing_date which is a denormalized backfill for '
  'past-client anniversary messaging; a transaction represents the full '
  'coordination context (deadlines, tasks, counterparties).';
comment on column public.transactions.mutual_acceptance_date is
  'Ratified-contract date. Anchor for all other deadline defaults. '
  'When set (or updated), the service layer recomputes NULL-valued '
  'deadlines via California defaults (17 days inspection, 21 loan, '
  '30 closing) unless the agent has already overridden them.';
comment on column public.transaction_tasks.seed_key is
  'Stable id for seeded tasks (open_escrow, schedule_inspection, etc.). '
  'Partial unique index on (transaction_id, seed_key) prevents re-seeding '
  'the same task when the seed constants evolve. NULL for agent-custom tasks.';


-- FILE: 20260486000000_transaction_nudge_log.sql

-- Daily-digest dedupe log for the Transaction Coordinator overdue-task cron.
--
-- The cron at /api/cron/transactions-overdue-nudges fires once per day. We
-- record (agent_id, digest_date) each time an agent actually receives a
-- digest so that:
--
--   * Vercel retries / manual curls don't double-send the same digest.
--   * The timing of yesterday's notification is queryable for debugging
--     "why didn't I get nudged?" complaints.
--
-- The unique constraint on (agent_id, digest_date) is the actual dedupe
-- gate — we INSERT first; if it conflicts we skip sending. This is safer
-- than SELECT-then-INSERT because two concurrent cron invocations (which
-- shouldn't happen but could on retry) would both see no row and both
-- send.
--
-- Retention: we don't need historical rows, but deleting them costs more
-- than keeping them. At one row per agent per day, 1000 agents × 365 days
-- = 365k rows/yr. Ignorable.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.transaction_nudge_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        digest_date date not null,
        task_count int not null default 0,
        overdue_count int not null default 0,
        upcoming_count int not null default 0,
        email_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (agent_id, digest_date)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.transaction_nudge_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        digest_date date not null,
        task_count int not null default 0,
        overdue_count int not null default 0,
        upcoming_count int not null default 0,
        email_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (agent_id, digest_date)
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_transaction_nudge_log_agent_date
  on public.transaction_nudge_log (agent_id, digest_date desc);


-- FILE: 20260487000000_transaction_listing_rep.sql

-- Listing-rep support for the Transaction Coordinator.
--
-- The buyer-rep MVP anchors all task offsets on `mutual_acceptance_date`.
-- Listing-side work has an earlier anchor — the day the RLA (Residential
-- Listing Agreement) is signed — for pre-list and active-marketing tasks.
-- Post-offer tasks still anchor on `mutual_acceptance_date`.
--
-- So we add `listing_start_date` as an optional second anchor. Buyer-rep
-- deals leave it null; listing-rep deals populate it at create time.
-- Dual-agency and future listing-rep-only flows both benefit.
--
-- Idempotent: safe to re-run.

alter table public.transactions
  add column if not exists listing_start_date date;

comment on column public.transactions.listing_start_date is
  'RLA signed / listing active date. Anchor for listing-rep seed tasks in the pre-list + active-marketing stages. Null for buyer-rep deals.';


-- FILE: 20260488000000_transaction_polish.sql

-- Transaction Coordinator polish round — two additions:
--
--   1. Per-agent opt-out / frequency controls for the overdue-task
--      digest, plus a wire-fraud SMS opt-in flag. Extends the existing
--      agent_notification_preferences table so agents see all push /
--      digest settings in one place.
--
--   2. transaction_wire_alert_log — dedupe + audit trail for the
--      wire-fraud SMS escalation cron. Mirrors transaction_nudge_log
--      but scoped to the single seed_key='verify_wire_instructions'
--      task that fires SMS (email digest covers everything else).

-- ── 1. Extend agent_notification_preferences ──────────────────────────

alter table public.agent_notification_preferences
  add column if not exists transaction_digest_enabled boolean not null default true;

alter table public.agent_notification_preferences
  add column if not exists transaction_digest_frequency text not null default 'daily';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_notification_preferences_tx_digest_freq_chk'
  ) then
    alter table public.agent_notification_preferences
      add constraint agent_notification_preferences_tx_digest_freq_chk
      check (transaction_digest_frequency in ('daily', 'weekly', 'off'));
  end if;
end $$;

alter table public.agent_notification_preferences
  add column if not exists wire_fraud_sms_enabled boolean not null default true;

comment on column public.agent_notification_preferences.transaction_digest_enabled is
  'Legacy kill-switch. When false, no digest is sent regardless of frequency. Kept as a separate flag so we can add more frequency options later without breaking the "off" state.';

comment on column public.agent_notification_preferences.transaction_digest_frequency is
  'daily (default), weekly (Monday only), or off (explicit opt-out).';

comment on column public.agent_notification_preferences.wire_fraud_sms_enabled is
  'Controls whether the closing-phase wire-verification SMS escalation fires. Defaults to on — this is a fraud-prevention alert, not marketing.';

-- ── 2. transaction_wire_alert_log ─────────────────────────────────────
-- Records when the wire-fraud SMS was sent for a given transaction.
-- The unique constraint on (transaction_id, alert_date) prevents
-- multiple SMS in the same day even if the cron fires repeatedly.
-- Columns mirror transaction_nudge_log for familiarity.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.transaction_wire_alert_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        alert_date date not null,
        days_to_close int,
        sms_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (transaction_id, alert_date)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.transaction_wire_alert_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        alert_date date not null,
        days_to_close int,
        sms_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (transaction_id, alert_date)
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_transaction_wire_alert_log_agent_date
  on public.transaction_wire_alert_log (agent_id, alert_date desc);


-- FILE: 20260489000000_showings.sql

-- Buyer-side showing workflow. Two tables:
--
--   showings          — one row per scheduled property visit
--   showing_feedback  — per-visit outcome (rating + pros/cons + offer flag).
--                       Separate table so we can add a visit that hasn't
--                       happened yet (no feedback) without forcing NULL
--                       soup on 10 columns. Also keeps feedback history
--                       (if an agent re-visits, we can add a second
--                       feedback row later.)
--
-- Why a dedicated subsystem vs tacking onto contacts:
--   A buyer attends 5-20 showings before writing an offer. The per-showing
--   record needs its own timestamp, access info, and listing-agent
--   contact — all property-specific, not buyer-specific. Stuffing it on
--   `contacts` would force a one-to-many hack.
--
-- Relationship to transactions:
--   `showings` is PRE-contract. Once a buyer writes a ratified offer,
--   the deal moves to `transactions`. No FK yet between the two — a
--   single buyer may have 20 showings and 0 transactions, and one
--   transaction may cover a property that was never a "showing" in our
--   system (off-market deal, buyer found it themselves).
--
-- Dual-type agent_id pattern — same as transactions migrations.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.showings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,           -- public listing link for quick reference

        scheduled_at timestamptz not null,
        duration_minutes int default 30,

        -- Access info lives inline (not a separate table) because it's
        -- one short blob per showing and never updated after the visit.
        access_notes text,      -- "lockbox 4-3-2-1, gate open, side door"
        listing_agent_name text,
        listing_agent_email text,
        listing_agent_phone text,

        status text not null default 'scheduled'
          check (status in ('scheduled', 'attended', 'cancelled', 'no_show')),
        cancellation_reason text,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.showing_feedback (
        id uuid primary key default gen_random_uuid(),
        showing_id uuid not null references public.showings(id) on delete cascade,

        -- 1-5 for quick sort; overall_reaction is the soft qualitative tag.
        rating int check (rating >= 1 and rating <= 5),
        overall_reaction text
          check (overall_reaction in ('love', 'like', 'maybe', 'pass')),

        pros text,
        cons text,
        notes text,

        would_offer boolean not null default false,
        price_concerns boolean not null default false,
        location_concerns boolean not null default false,
        condition_concerns boolean not null default false,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.showings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,

        scheduled_at timestamptz not null,
        duration_minutes int default 30,

        access_notes text,
        listing_agent_name text,
        listing_agent_email text,
        listing_agent_phone text,

        status text not null default 'scheduled'
          check (status in ('scheduled', 'attended', 'cancelled', 'no_show')),
        cancellation_reason text,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.showing_feedback (
        id uuid primary key default gen_random_uuid(),
        showing_id uuid not null references public.showings(id) on delete cascade,

        rating int check (rating >= 1 and rating <= 5),
        overall_reaction text
          check (overall_reaction in ('love', 'like', 'maybe', 'pass')),

        pros text,
        cons text,
        notes text,

        would_offer boolean not null default false,
        price_concerns boolean not null default false,
        location_concerns boolean not null default false,
        condition_concerns boolean not null default false,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

-- List queries are always "this agent's showings, recent first" or
-- "this buyer's showings." These two indexes cover both.
create index if not exists idx_showings_agent_scheduled
  on public.showings (agent_id, scheduled_at desc);

create index if not exists idx_showings_contact_scheduled
  on public.showings (contact_id, scheduled_at desc);

create index if not exists idx_showing_feedback_showing
  on public.showing_feedback (showing_id);

-- One feedback per showing for the MVP. If we later support multi-visit
-- feedback (same property, later re-visit), drop this and the UI groups
-- by created_at instead. Keep it simple for now.
create unique index if not exists uniq_showing_feedback_showing
  on public.showing_feedback (showing_id);


-- FILE: 20260490000000_showings_gcal.sql

-- Google Calendar sync for showings.
--
-- Stores the Google Calendar event id so we can update / delete the
-- remote event when an agent changes a showing locally. Null means
-- either the agent hasn't connected Google Calendar yet, the sync
-- failed gracefully (we don't crash the primary write for a calendar
-- issue), or the showing is from before the sync feature.
--
-- We deliberately do NOT reuse `lead_calendar_events` for showings.
-- That table is scoped to lead-level events (meetings from the
-- reminder system) and carries FK + triggers specific to that flow.
-- Showings are lifecycle-adjacent (pre-contract visits) and belong
-- with the showings row.

alter table public.showings
  add column if not exists google_event_id text;

comment on column public.showings.google_event_id is
  'Google Calendar event id returned by Google when we synced this showing. Null = never synced or sync failed. See lib/google-calendar/sync.ts.';


-- FILE: 20260491000000_offers.sql

-- Buyer-side offer tracker. Closes the gap between showing (buyer
-- wants to make an offer) and transaction (ratified contract).
--
-- Two tables:
--
--   offers          — one row per offer attempt. Lifecycle: draft →
--                     submitted → countered* → accepted / rejected /
--                     withdrawn / expired. Accepted offers spawn a
--                     transaction (via service.convertOfferToTransaction).
--
--   offer_counters  — one row per counter round. Offers frequently go
--                     through 2-4 rounds; capturing the history gives
--                     agents + buyers a clear negotiation record and
--                     lets us show a timeline on the detail page.
--
-- Why a dedicated subsystem vs extending transactions:
--   * Transactions are post-ratification deal management (escrow,
--     contingencies, closing). Offers are pre-ratification negotiation.
--     90% of offers never become transactions — most are outbid,
--     rejected, or withdrawn.
--   * A buyer typically writes 3-8 offers before one gets accepted.
--     Keeping them in their own table keeps the transactions list
--     clean and the win-rate analytics honest.
--
-- Relationship to other entities:
--   * `showing_id` (nullable) — an offer often comes from a showing
--     where the buyer flagged "would_offer". Not required: some offers
--     are sight-unseen, some come from new-construction walkthroughs
--     that weren't logged as showings.
--   * `transaction_id` (nullable) — populated at the moment of
--     conversion. Lets us trace any transaction back to its origin
--     offer for win-rate / negotiation analysis.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.offers (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        -- Optional provenance links
        showing_id uuid references public.showings(id) on delete set null,
        transaction_id uuid references public.transactions(id) on delete set null,

        -- Property identity
        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,
        list_price numeric,

        -- Offer terms
        offer_price numeric not null,
        earnest_money numeric,
        down_payment numeric,
        financing_type text
          check (financing_type in ('cash', 'conventional', 'fha', 'va', 'jumbo', 'other')),
        closing_date_proposed date,

        -- Common contingencies — inline booleans for cheap filtering.
        -- `contingency_notes` holds anything unusual the booleans can't
        -- capture (sale-of-home, short-sale waiting, etc.).
        inspection_contingency boolean not null default true,
        appraisal_contingency boolean not null default true,
        loan_contingency boolean not null default true,
        contingency_notes text,

        -- Status lifecycle
        status text not null default 'draft'
          check (status in ('draft', 'submitted', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
        current_price numeric,          -- latest price after counters
        offer_expires_at timestamptz,   -- "offer good through" timestamp

        -- Timestamps for key lifecycle events (more useful than status history alone)
        submitted_at timestamptz,
        accepted_at timestamptz,
        closed_at timestamptz,          -- rejected/withdrawn/expired

        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.offer_counters (
        id uuid primary key default gen_random_uuid(),
        offer_id uuid not null references public.offers(id) on delete cascade,
        counter_number int not null,            -- 1, 2, 3... within this offer
        direction text not null
          check (direction in ('seller_to_buyer', 'buyer_to_seller')),
        price numeric,
        changed_fields jsonb,                    -- free-form record of what moved
        notes text,
        created_at timestamptz not null default now(),
        unique (offer_id, counter_number)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.offers (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        showing_id uuid references public.showings(id) on delete set null,
        transaction_id uuid references public.transactions(id) on delete set null,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,
        list_price numeric,

        offer_price numeric not null,
        earnest_money numeric,
        down_payment numeric,
        financing_type text
          check (financing_type in ('cash', 'conventional', 'fha', 'va', 'jumbo', 'other')),
        closing_date_proposed date,

        inspection_contingency boolean not null default true,
        appraisal_contingency boolean not null default true,
        loan_contingency boolean not null default true,
        contingency_notes text,

        status text not null default 'draft'
          check (status in ('draft', 'submitted', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
        current_price numeric,
        offer_expires_at timestamptz,

        submitted_at timestamptz,
        accepted_at timestamptz,
        closed_at timestamptz,

        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.offer_counters (
        id uuid primary key default gen_random_uuid(),
        offer_id uuid not null references public.offers(id) on delete cascade,
        counter_number int not null,
        direction text not null
          check (direction in ('seller_to_buyer', 'buyer_to_seller')),
        price numeric,
        changed_fields jsonb,
        notes text,
        created_at timestamptz not null default now(),
        unique (offer_id, counter_number)
      )
    $sql$;
  end if;
end $$;

-- List queries are always "this agent's offers, recent first" or
-- "this buyer's offers." These two indexes cover both.
create index if not exists idx_offers_agent_created
  on public.offers (agent_id, created_at desc);

create index if not exists idx_offers_contact_created
  on public.offers (contact_id, created_at desc);

-- Win-rate analytics queries will filter on status.
create index if not exists idx_offers_agent_status
  on public.offers (agent_id, status);

create index if not exists idx_offer_counters_offer
  on public.offer_counters (offer_id, counter_number);


-- FILE: 20260492000000_commission_tracking.sql

-- Commission tracking for the agent performance dashboard.
--
-- Two additions:
--   1. Per-transaction commission columns — capture the deal economics
--      at close time so historical GCI + net-commission math doesn't
--      shift when an agent updates their default percentages later.
--   2. Per-agent default prefs — the defaults the agent wants applied
--      when a new transaction is created or closed.
--
-- Design notes:
--   * Amounts are stored alongside percentages. Even though either
--     alone is enough to derive the other from purchase_price, keeping
--     both makes dashboards + CSV exports trivially queryable without
--     N+1 math. Storage cost is negligible.
--   * `agent_net_commission` is what the agent actually takes home
--     after brokerage split + referral fees. This is the "how much did
--     I make" number agents actually care about — the raw GCI number
--     is what their brokerage / IRS sees.
--   * Brokerage split is stored as the AGENT'S share pct (e.g., 70
--     means 70/30 split favoring the agent). That's how agents talk
--     about it ("I'm on a 70/30 at Compass"), not "the brokerage takes
--     30%."
--
-- Recompute trigger:
--   None. The service layer writes these on transaction close +
--   whenever the agent updates commission fields manually. A trigger
--   would fight with manual overrides agents make for unusual deals
--   (referral fees, bonus splits, credit to buyer).

-- ── 1. transactions: per-deal commission columns ──────────────────────

alter table public.transactions
  add column if not exists commission_pct numeric;

alter table public.transactions
  add column if not exists gross_commission numeric;

alter table public.transactions
  add column if not exists brokerage_split_pct numeric;

alter table public.transactions
  add column if not exists referral_fee_pct numeric;

alter table public.transactions
  add column if not exists agent_net_commission numeric;

comment on column public.transactions.commission_pct is
  'Percentage of purchase_price. 2.5 = 2.5%. Typical buyer-rep is 2.5, listing-rep is 3.0 — but always verify the offer of cooperation + RLA.';

comment on column public.transactions.gross_commission is
  'Agent side of the commission before any splits: purchase_price * commission_pct / 100. Stored (not derived) so historical dashboards stay stable if the percentage column is later edited.';

comment on column public.transactions.brokerage_split_pct is
  'Agent share of the split. 70 = 70/30 favoring the agent.';

comment on column public.transactions.referral_fee_pct is
  'Referral fee paid to another agent or referral company. Applied to gross_commission BEFORE brokerage split (standard practice).';

comment on column public.transactions.agent_net_commission is
  'What the agent takes home after referral fee + brokerage split. Computed: gross * (1 - referral/100) * (split/100).';

-- ── 2. agent_commission_prefs ────────────────────────────────────────
-- Per-agent defaults. Dual-type agent_id dispatch so the migration
-- works on both uuid + bigint agents.id installs.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.agent_commission_prefs (
        agent_id uuid primary key references public.agents(id) on delete cascade,
        default_commission_pct_buyer numeric not null default 2.5,
        default_commission_pct_listing numeric not null default 3.0,
        default_brokerage_split_pct numeric not null default 70.0,
        default_referral_fee_pct numeric not null default 0.0,
        updated_at timestamptz not null default now(),
        constraint agent_commission_prefs_pct_chk
          check (
            default_commission_pct_buyer >= 0 and default_commission_pct_buyer <= 15 and
            default_commission_pct_listing >= 0 and default_commission_pct_listing <= 15 and
            default_brokerage_split_pct >= 0 and default_brokerage_split_pct <= 100 and
            default_referral_fee_pct >= 0 and default_referral_fee_pct <= 100
          )
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.agent_commission_prefs (
        agent_id bigint primary key references public.agents(id) on delete cascade,
        default_commission_pct_buyer numeric not null default 2.5,
        default_commission_pct_listing numeric not null default 3.0,
        default_brokerage_split_pct numeric not null default 70.0,
        default_referral_fee_pct numeric not null default 0.0,
        updated_at timestamptz not null default now(),
        constraint agent_commission_prefs_pct_chk
          check (
            default_commission_pct_buyer >= 0 and default_commission_pct_buyer <= 15 and
            default_commission_pct_listing >= 0 and default_commission_pct_listing <= 15 and
            default_brokerage_split_pct >= 0 and default_brokerage_split_pct <= 100 and
            default_referral_fee_pct >= 0 and default_referral_fee_pct <= 100
          )
      )
    $sql$;
  end if;
end $$;

comment on table public.agent_commission_prefs is
  'Per-agent commission defaults. Applied when a transaction is created/closed without explicit overrides. Can be edited from /dashboard/settings.';


-- FILE: 20260493000000_growth_opportunities_cache.sql

-- Cache for AI-generated "Growth & Opportunities" suggestions on
-- /dashboard/growth.
--
-- Claude calls for opportunity generation are ~$0.05-0.15 per run and
-- take 10-20s. Without a cache, every page load hits the model —
-- agents refresh this tab a few times a day and we'd burn budget for
-- marginal value. A 1-hour TTL matches how fast the underlying data
-- moves (contacts + deals change hourly, not every minute).
--
-- `payload jsonb` stores the full list of opportunity cards as
-- generated. If the schema evolves, we invalidate all rows — cheap
-- to regenerate on next page load.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.growth_opportunities_cache (
        agent_id uuid primary key references public.agents(id) on delete cascade,
        payload jsonb not null,
        generated_at timestamptz not null default now(),
        expires_at timestamptz not null
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.growth_opportunities_cache (
        agent_id bigint primary key references public.agents(id) on delete cascade,
        payload jsonb not null,
        generated_at timestamptz not null default now(),
        expires_at timestamptz not null
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_growth_opportunities_cache_expires
  on public.growth_opportunities_cache (expires_at);

comment on table public.growth_opportunities_cache is
  'Per-agent cache of Claude-generated growth opportunities. 1h TTL; force-refresh from the UI regenerate button.';


-- FILE: 20260494000000_growth_weekly_digest.sql

-- Weekly Growth & Opportunities digest email.
--
-- Runs every Monday morning, picks the top 3 AI-generated opportunities
-- for each active agent, and sends a summary email. Turns the dashboard
-- feature from pull (agent opens tab) to push (agent sees it Monday
-- morning).
--
-- Two additions:
--   1. `growth_digest_enabled` on agent_notification_preferences —
--      per-agent opt-out. Defaults to on, same shape as the other
--      digest toggles.
--   2. `growth_digest_log` — dedupe + audit trail. Unique per
--      (agent_id, digest_date) so Vercel cron retries don't
--      double-send. Mirrors the transaction_nudge_log pattern.

alter table public.agent_notification_preferences
  add column if not exists growth_digest_enabled boolean not null default true;

comment on column public.agent_notification_preferences.growth_digest_enabled is
  'Weekly Growth & Opportunities email digest. Defaults on — the feature sends only when the agent has 2+ opportunities, so inactive agents won''t get noise anyway.';

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.growth_digest_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        digest_date date not null,
        opportunity_count int not null default 0,
        email_sent boolean not null default false,
        skipped_reason text,
        error text,
        created_at timestamptz not null default now(),
        unique (agent_id, digest_date)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.growth_digest_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        digest_date date not null,
        opportunity_count int not null default 0,
        email_sent boolean not null default false,
        skipped_reason text,
        error text,
        created_at timestamptz not null default now(),
        unique (agent_id, digest_date)
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_growth_digest_log_agent_date
  on public.growth_digest_log (agent_id, digest_date desc);


-- FILE: 20260495000000_listing_offers.sql

-- Listing-side offer review. Mirror of the buyer-side offer tracker
-- for agents representing sellers.
--
-- A listing agent typically fields 2-10 competing offers on a single
-- listing and needs to compare them side-by-side, factor net-to-seller
-- (not just sticker price), negotiate counters, and accept one.
--
-- Why a new table vs extending `offers`:
--   * offers.contact_id = the BUYER (our client) on the buyer side.
--     On the listing side, the offeror is someone else's client —
--     we have buyer-agent contact info but not CRM-contact status.
--     Overloading contact_id with two semantics leads to messy
--     queries + accidental cross-contamination.
--   * The counter mechanics are conceptually identical but domain-
--     separate. We duplicate the pattern instead of sharing — zero
--     test or runtime coupling between buyer + listing flows.
--
-- FK: `transaction_id` points at a transactions row with
-- transaction_type in ('listing_rep', 'dual'). Not enforced in
-- schema because the CHECK would require a function call; enforced
-- in the service layer.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.listing_offers (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,

        -- Offeror identity (the buyer + their agent; NOT our CRM contacts)
        buyer_name text,
        buyer_brokerage text,
        buyer_agent_name text,
        buyer_agent_email text,
        buyer_agent_phone text,

        -- Offer terms
        offer_price numeric not null,
        current_price numeric,
        earnest_money numeric,
        down_payment numeric,
        financing_type text
          check (financing_type in ('cash', 'conventional', 'fha', 'va', 'jumbo', 'other')),
        closing_date_proposed date,

        -- Contingencies (inline booleans + free-form notes)
        inspection_contingency boolean not null default true,
        appraisal_contingency boolean not null default true,
        loan_contingency boolean not null default true,
        sale_of_home_contingency boolean not null default false,
        contingency_notes text,

        -- Seller-side concessions this offer requests
        seller_concessions numeric,

        -- Lifecycle
        status text not null default 'submitted'
          check (status in ('submitted', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
        offer_expires_at timestamptz,
        submitted_at timestamptz default now(),
        accepted_at timestamptz,
        closed_at timestamptz,

        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.listing_offer_counters (
        id uuid primary key default gen_random_uuid(),
        listing_offer_id uuid not null references public.listing_offers(id) on delete cascade,
        counter_number int not null,
        direction text not null
          check (direction in ('seller_to_buyer', 'buyer_to_seller')),
        price numeric,
        changed_fields jsonb,
        notes text,
        created_at timestamptz not null default now(),
        unique (listing_offer_id, counter_number)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.listing_offers (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,

        buyer_name text,
        buyer_brokerage text,
        buyer_agent_name text,
        buyer_agent_email text,
        buyer_agent_phone text,

        offer_price numeric not null,
        current_price numeric,
        earnest_money numeric,
        down_payment numeric,
        financing_type text
          check (financing_type in ('cash', 'conventional', 'fha', 'va', 'jumbo', 'other')),
        closing_date_proposed date,

        inspection_contingency boolean not null default true,
        appraisal_contingency boolean not null default true,
        loan_contingency boolean not null default true,
        sale_of_home_contingency boolean not null default false,
        contingency_notes text,

        seller_concessions numeric,

        status text not null default 'submitted'
          check (status in ('submitted', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
        offer_expires_at timestamptz,
        submitted_at timestamptz default now(),
        accepted_at timestamptz,
        closed_at timestamptz,

        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.listing_offer_counters (
        id uuid primary key default gen_random_uuid(),
        listing_offer_id uuid not null references public.listing_offers(id) on delete cascade,
        counter_number int not null,
        direction text not null
          check (direction in ('seller_to_buyer', 'buyer_to_seller')),
        price numeric,
        changed_fields jsonb,
        notes text,
        created_at timestamptz not null default now(),
        unique (listing_offer_id, counter_number)
      )
    $sql$;
  end if;
end $$;

-- Compare view is the primary query: "all offers on this listing,
-- ordered by price desc." Secondary: agent-wide status roll-ups.
create index if not exists idx_listing_offers_transaction
  on public.listing_offers (transaction_id, status);

create index if not exists idx_listing_offers_agent_created
  on public.listing_offers (agent_id, created_at desc);

create index if not exists idx_listing_offer_counters_offer
  on public.listing_offer_counters (listing_offer_id, counter_number);


-- FILE: 20260496000000_open_houses.sql

-- Open House workflow: scheduled events + digital sign-in + follow-up.
--
-- Today agents run open houses on paper sign-in sheets. Visitors get
-- lost, follow-up is manual, and we have no attribution. This replaces
-- that with:
--
--   1. `open_houses`              — scheduled event.
--   2. `open_house_visitors`      — people who signed in at the door
--                                   via a public URL / QR code.
--
-- Public sign-in URL: `/oh/{slug}`. The `signin_slug` is generated on
-- create (12 random chars, URL-safe) and is the only token needed — no
-- auth. Agents share it via QR displayed on an iPad. Low abuse risk
-- for MVP (real visitors use it, spam is unlikely when no rewards
-- flow to the spammer), but we can add hCaptcha if needed.
--
-- Visitor → contact intake: after sign-in the service-layer upserts a
-- row in `contacts` (source='Open House') and back-links
-- `open_house_visitors.contact_id`. The agent's existing nurture
-- pipelines pick up from there.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.open_houses (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        -- Optional back-link to a listing-rep transaction. Lets the
        -- transaction detail page surface a "sign-in URL" action.
        transaction_id uuid references public.transactions(id) on delete set null,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,
        list_price numeric,

        -- Event window
        start_at timestamptz not null,
        end_at timestamptz not null,

        -- Public sign-in token. 12 URL-safe chars — collision risk at
        -- 62^12 = negligible vs our agent count. Indexed for fast lookup.
        signin_slug text not null unique,

        host_notes text,
        status text not null default 'scheduled'
          check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.open_house_visitors (
        id uuid primary key default gen_random_uuid(),
        open_house_id uuid not null references public.open_houses(id) on delete cascade,
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        -- Visitor identity (raw entry from the public form)
        name text,
        email text,
        phone text,

        -- Are they already working with an agent? If so, we don't add
        -- them to the nurture pipeline — that'd be an ethics breach
        -- (and Realtor® code-of-ethics violation).
        is_buyer_agented boolean not null default false,
        buyer_agent_name text,
        buyer_agent_brokerage text,

        -- Qualification signals the agent asks in the form
        timeline text
          check (timeline in ('now', '3_6_months', '6_12_months', 'later', 'just_looking')),
        buyer_status text
          check (buyer_status in ('looking', 'just_browsing', 'neighbor', 'other')),

        -- Marketing consent — required for post-event outreach per CAN-SPAM / TCPA.
        -- Defaults false; if the visitor taps "yes, send similar listings", we set true.
        marketing_consent boolean not null default false,

        -- Follow-up automation tracking
        thank_you_sent_at timestamptz,
        check_in_sent_at timestamptz,

        notes text,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.open_houses (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        transaction_id uuid references public.transactions(id) on delete set null,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,
        list_price numeric,

        start_at timestamptz not null,
        end_at timestamptz not null,

        signin_slug text not null unique,

        host_notes text,
        status text not null default 'scheduled'
          check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.open_house_visitors (
        id uuid primary key default gen_random_uuid(),
        open_house_id uuid not null references public.open_houses(id) on delete cascade,
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        name text,
        email text,
        phone text,

        is_buyer_agented boolean not null default false,
        buyer_agent_name text,
        buyer_agent_brokerage text,

        timeline text
          check (timeline in ('now', '3_6_months', '6_12_months', 'later', 'just_looking')),
        buyer_status text
          check (buyer_status in ('looking', 'just_browsing', 'neighbor', 'other')),

        marketing_consent boolean not null default false,

        thank_you_sent_at timestamptz,
        check_in_sent_at timestamptz,

        notes text,
        created_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_open_houses_agent_start
  on public.open_houses (agent_id, start_at desc);

create index if not exists idx_open_houses_slug
  on public.open_houses (signin_slug);

create index if not exists idx_open_house_visitors_open_house
  on public.open_house_visitors (open_house_id, created_at desc);

-- Follow-up cron queries: "visitors created 20-30h ago who haven't
-- gotten a thank-you yet" and "visitors created 3-4 days ago who
-- haven't gotten a check-in yet." Partial indexes keep these fast
-- as the visitor table grows.
create index if not exists idx_open_house_visitors_thank_you_due
  on public.open_house_visitors (created_at)
  where thank_you_sent_at is null and marketing_consent = true;

create index if not exists idx_open_house_visitors_checkin_due
  on public.open_house_visitors (created_at)
  where check_in_sent_at is null and marketing_consent = true;


-- FILE: 20260497000000_seller_weekly_updates.sql

-- Weekly seller-update email feature.
--
-- On active listing_rep / dual transactions, the listing agent can
-- enable a Monday-morning email to the seller summarizing activity
-- since the last report: open-house visitors, offers in, AI-generated
-- market commentary + recommendation.
--
-- Two columns on `transactions`:
--   * seller_update_enabled     — opt-in toggle. Default FALSE: emailing
--                                 sellers is a bigger action than emailing
--                                 agents, so agents must explicitly flip
--                                 this on per-listing.
--   * seller_update_last_sent_at — dedupe + report window anchor.
--                                 Next week's email covers activity
--                                 since this timestamp.
--
-- No separate log table — last-sent timestamp is the primary dedupe
-- signal (one email per week per listing; if Vercel retries, we won't
-- re-send because last-sent will be within the 6-day floor).

alter table public.transactions
  add column if not exists seller_update_enabled boolean not null default false;

alter table public.transactions
  add column if not exists seller_update_last_sent_at timestamptz;

comment on column public.transactions.seller_update_enabled is
  'Opt-in toggle for the Monday-morning seller update email. Only applicable to listing_rep / dual transactions; the cron skips buyer-rep regardless.';

comment on column public.transactions.seller_update_last_sent_at is
  'Timestamp of the most recent seller update sent. Cron uses this to dedupe (minimum 6 days between sends) and to determine the activity window for the next report.';

-- The cron query needs to scan active listings with the toggle on.
-- Partial index keeps this cheap — only matches rows that matter.
create index if not exists idx_transactions_seller_update_due
  on public.transactions (seller_update_last_sent_at nulls first)
  where seller_update_enabled = true
    and status in ('active', 'pending')
    and transaction_type in ('listing_rep', 'dual');


-- FILE: 20260498000000_offer_expiration_alerts.sql

-- Offer expiration alerts.
--
-- When an offer is about to expire (within 24h) and hasn't been
-- accepted/rejected/countered, the agent needs a nudge. Silent
-- expirations cost deals.
--
-- Dedupe log per (offer_id, alert_level, alert_date) — we send two
-- alerts per offer:
--   * `warning` at 24h before expiration
--   * `final`   at 2h before expiration
--
-- Covers BOTH offer tables (buyer-side `offers` and listing-side
-- `listing_offers`) — one log table, two offer kinds distinguished
-- by the `offer_kind` column.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.offer_expiration_alert_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        offer_kind text not null check (offer_kind in ('buyer', 'listing')),
        offer_id uuid not null,
        alert_level text not null check (alert_level in ('warning', 'final')),
        alert_date date not null,
        email_sent boolean not null default false,
        sms_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (offer_kind, offer_id, alert_level, alert_date)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.offer_expiration_alert_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        offer_kind text not null check (offer_kind in ('buyer', 'listing')),
        offer_id uuid not null,
        alert_level text not null check (alert_level in ('warning', 'final')),
        alert_date date not null,
        email_sent boolean not null default false,
        sms_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (offer_kind, offer_id, alert_level, alert_date)
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_offer_expiration_alert_log_agent_date
  on public.offer_expiration_alert_log (agent_id, alert_date desc);


-- FILE: 20260499000000_transaction_reviews.sql

-- AI deal-review cache. When an agent opens a CLOSED transaction and
-- asks for a post-mortem, we feed a structured snapshot to Claude and
-- cache the generated review here. Closed deals don't change, so the
-- cache never expires — but a "Regenerate" button can overwrite.
--
-- `payload` is a jsonb of { summary, whatWentWell, whereItStalled,
-- doDifferentlyNextTime, ... } — shape defined in lib/deal-review/types.ts.
-- If the schema evolves, bump a version field inside the payload;
-- wiping the cache table is a safe last resort.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.transaction_reviews (
        transaction_id uuid primary key references public.transactions(id) on delete cascade,
        agent_id uuid not null references public.agents(id) on delete cascade,
        payload jsonb not null,
        generated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.transaction_reviews (
        transaction_id uuid primary key references public.transactions(id) on delete cascade,
        agent_id bigint not null references public.agents(id) on delete cascade,
        payload jsonb not null,
        generated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_transaction_reviews_agent
  on public.transaction_reviews (agent_id, generated_at desc);

comment on table public.transaction_reviews is
  'Claude-generated post-close debrief per transaction. One row per transaction (transaction_id PK). Regeneration overwrites.';


-- FILE: 20260500000000_listing_feedback.sql

-- Cross-agent feedback on listings.
--
-- The listing agent's blind spot: when a buyer-rep agent shows their
-- listing, that showing + any feedback lives in the BUYER agent's
-- scoped tables. The listing agent never sees it unless someone
-- emails it over. Industry workaround: ShowingTime etc. route a
-- feedback form to the buyer agent after every showing.
--
-- This is our homegrown version. Flow:
--   1. Listing agent records that a buyer agent showed the listing
--      (buyer_agent_name, email, showing_date) — creates a row with a
--      unique `request_slug`.
--   2. We email the buyer agent a link to /feedback/<slug>.
--   3. Buyer agent (or their buyer) fills out the public form. The
--      row is updated with rating, pros, cons, notes, submitted_at.
--   4. Listing agent sees all responses on the transaction detail +
--      in the weekly seller update email.
--
-- One table (no separate request vs response tables) — state flows
-- via submitted_at null/non-null. Simpler, no join required to show
-- "pending vs received."

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.listing_feedback (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,

        -- Buyer-side identity (free-form strings — not CRM contacts)
        buyer_agent_name text,
        buyer_agent_email text,
        buyer_agent_phone text,
        buyer_agent_brokerage text,
        buyer_name text,

        -- Event metadata
        showing_date date,

        -- Public form token (12 chars, url-safe)
        request_slug text not null unique,
        request_email_sent_at timestamptz,

        -- Response fields — populated when the buyer agent submits the form
        submitted_at timestamptz,
        rating int check (rating >= 1 and rating <= 5),
        overall_reaction text
          check (overall_reaction in ('love', 'like', 'maybe', 'pass')),
        pros text,
        cons text,
        price_feedback text
          check (price_feedback in ('too_high', 'about_right', 'bargain')),
        would_offer boolean,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.listing_feedback (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,

        buyer_agent_name text,
        buyer_agent_email text,
        buyer_agent_phone text,
        buyer_agent_brokerage text,
        buyer_name text,

        showing_date date,

        request_slug text not null unique,
        request_email_sent_at timestamptz,

        submitted_at timestamptz,
        rating int check (rating >= 1 and rating <= 5),
        overall_reaction text
          check (overall_reaction in ('love', 'like', 'maybe', 'pass')),
        pros text,
        cons text,
        price_feedback text
          check (price_feedback in ('too_high', 'about_right', 'bargain')),
        would_offer boolean,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

-- Primary query: "all feedback on this listing, responses first then pending"
create index if not exists idx_listing_feedback_transaction
  on public.listing_feedback (transaction_id, submitted_at desc nulls last);

-- Secondary: fast slug lookup for the public form
create index if not exists idx_listing_feedback_slug
  on public.listing_feedback (request_slug);


-- FILE: 20260501000000_open_houses_recurrence.sql

-- Recurring open houses: a single "recurrence_group_id" stitches
-- together the N rows that were created from one schedule (weekly
-- pattern or multi-date pick). Each occurrence is still its own row
-- with its own slug and its own visitor list — the group_id is
-- purely cosmetic (list grouping) and lets us cancel the series.
--
-- NULL means "one-off" (the existing default).

alter table public.open_houses
  add column if not exists recurrence_group_id uuid;

create index if not exists idx_open_houses_recurrence_group
  on public.open_houses (recurrence_group_id)
  where recurrence_group_id is not null;


-- FILE: 20260502000000_playbook_tasks.sql

-- Playbook tasks — curated checklists applied to a transaction, open
-- house, contact, or a bare anchor date. Templates themselves live in
-- TypeScript (lib/playbooks/definitions.ts) — static, code-managed, so
-- new agents get updates the instant we deploy. This table stores
-- only the per-agent INSTANCES created when a playbook is applied.
--
-- Anchor polymorphism: `anchor_kind` tells us which entity `anchor_id`
-- points at. Foreign-key enforcement is application-level (anchor
-- could be null for 'generic' bare-date anchors).

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.playbook_task_instances (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,

        -- Anchor. 'generic' means no linked entity (bare checklist).
        anchor_kind text not null
          check (anchor_kind in ('transaction', 'open_house', 'contact', 'generic')),
        anchor_id uuid,

        -- Template provenance. NULL if the agent added a custom task
        -- not generated from a playbook.
        template_key text,
        -- All rows generated from one "apply playbook" click share this
        -- batch id — lets us render a per-playbook panel and offer
        -- "remove whole playbook" as one action.
        apply_batch_id uuid,

        title text not null,
        notes text,
        -- Section label (e.g. "Before open house" / "Day of" / "After")
        -- — purely for grouping in the UI.
        section text,

        -- Relative offset stored alongside absolute due_date so we can
        -- re-compute after an anchor date change.
        offset_days integer,
        due_date date,

        completed_at timestamptz,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.playbook_task_instances (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,

        anchor_kind text not null
          check (anchor_kind in ('transaction', 'open_house', 'contact', 'generic')),
        anchor_id uuid,

        template_key text,
        apply_batch_id uuid,

        title text not null,
        notes text,
        section text,

        offset_days integer,
        due_date date,

        completed_at timestamptz,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

-- List-by-anchor: the hot query pattern (detail pages render their
-- anchor's instances). Partial index on (completed_at is null) keeps
-- the "open tasks" query fast as historical tasks accumulate.
create index if not exists idx_playbook_tasks_agent_anchor
  on public.playbook_task_instances (agent_id, anchor_kind, anchor_id);

create index if not exists idx_playbook_tasks_open
  on public.playbook_task_instances (agent_id, due_date)
  where completed_at is null;

-- Group by batch for "applied playbook" chip rendering.
create index if not exists idx_playbook_tasks_batch
  on public.playbook_task_instances (apply_batch_id)
  where apply_batch_id is not null;


-- FILE: 20260503000000_ai_action_quotas.sql

-- AI action metering for agent plans.
--
-- Context: Starter users currently have free rein on every AI-bearing
-- endpoint (CMA generation / deal review / growth opps / etc.), which
-- means a single Starter agent can burn more Claude tokens in a week
-- than a Pro customer's LTV. This migration introduces a per-plan
-- monthly AI-action quota the same way CMA reports are already
-- per-day limited.
--
-- "AI action" is a single logical call: one CMA, one deal review, one
-- growth-ops refresh, etc. The cost per call varies in tokens but is
-- flat in our UX ("1 AI action"). Plan caps:
--   Starter: 10 / month
--   Growth:  500 / month
--   Elite:   NULL = unlimited
--
-- This migration:
--   1) adds ai_actions_per_month to product_entitlements (plan cap)
--   2) adds ai_actions_used to entitlement_usage_daily (daily bucket)
--   3) creates a helper view that rolls up monthly usage per (user,
--      product) so the check-limit helper can query it in one read.

alter table public.product_entitlements
  add column if not exists ai_actions_per_month integer;

comment on column public.product_entitlements.ai_actions_per_month is
  'Per-plan monthly cap on AI-bearing actions (CMA / deal review / growth / AI SMS). NULL = unlimited.';

alter table public.entitlement_usage_daily
  add column if not exists ai_actions_used integer not null default 0;

comment on column public.entitlement_usage_daily.ai_actions_used is
  'Count of AI actions charged on this UTC date bucket. Rolled up into a monthly view for quota checks.';

-- Rolling monthly AI usage per (user, product). Month = UTC calendar
-- month of usage_date. A materialized view would be overkill — the
-- underlying daily table is tiny per user, so a plain view is fine.
create or replace view public.entitlement_ai_usage_monthly as
select
  user_id,
  product,
  date_trunc('month', usage_date)::date as month_start,
  sum(ai_actions_used)::integer as ai_actions_used
from public.entitlement_usage_daily
group by user_id, product, date_trunc('month', usage_date);

comment on view public.entitlement_ai_usage_monthly is
  'Rolling monthly AI-action counters, aggregated from daily buckets. Used by canUseAiAction.';

-- Backfill the monthly token cap onto existing entitlement rows. We
-- present these as "AI tokens" in UI copy (see planCatalog.ts) to
-- match the mental model of finer-grained usage — internally still
-- 1 cap unit = 1 AI action for now.
--
-- Starter: 100 / Pro (growth): 5,000 / Elite: unlimited (NULL).
update public.product_entitlements
set ai_actions_per_month = 100
where plan = 'starter'
  and ai_actions_per_month is null;

update public.product_entitlements
set ai_actions_per_month = 5000
where plan = 'growth'
  and ai_actions_per_month is null;
-- Elite stays NULL (unlimited).


-- FILE: 20260504000000_referrals_and_bonus_tokens.sql

-- Referral program + bonus token wallet.
--
-- Two user-wallets live side-by-side for AI tokens:
--   1. monthly quota on product_entitlements.ai_actions_per_month
--      (resets every calendar month, comes with the plan)
--   2. bonus_tokens on leadsmart_users (perpetual wallet, only
--      refilled by referrals / promos / manual admin grants)
--
-- Consumption rule (see lib/entitlements/accessResult.ts):
--   charge bonus_tokens first; fall back to monthly quota only
--   when bonus is exhausted. This makes referrals feel rewarding
--   (they actually extend the user's runway) rather than silently
--   disappearing into a cap they never reach.
--
-- Referral flow:
--   - Each user has a stable 8-char code (referral_code).
--   - A referral row is created when a new user signs up with
--     ?ref=CODE — status starts 'pending'.
--   - On successful onboarding (complete-profile finalized, or
--     starter plan assigned, whichever comes first) the status
--     flips to 'completed' and both users get +20,000 bonus tokens
--     in a single atomic bump. bonus_granted_at makes the grant
--     idempotent — a retry can't double-pay.

alter table public.leadsmart_users
  add column if not exists referral_code text unique,
  add column if not exists bonus_tokens integer not null default 0;

comment on column public.leadsmart_users.referral_code is
  'Stable 8-char code the user can share. `?ref=CODE` on signup links them as a referrer.';
comment on column public.leadsmart_users.bonus_tokens is
  'Perpetual AI-token wallet. Consumed before the monthly plan quota. Topped up by referrals + promos.';

-- Backfill a code for every existing user who doesn't have one.
-- Uses substr(md5(user_id)) so it's deterministic + collision-free
-- within the existing user set.
update public.leadsmart_users
set referral_code = upper(substr(md5(user_id::text || 'referral-salt-2026'), 1, 8))
where referral_code is null;

create table if not exists public.user_referrals (
  id uuid primary key default gen_random_uuid(),
  -- The user who shared the code
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  -- The user who signed up via it
  referee_user_id uuid not null references auth.users(id) on delete cascade,
  -- 'pending'  = signed up, not yet through onboarding
  -- 'completed' = bonuses granted
  -- 'expired'   = 30+ days stale and referee never completed
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired')),
  -- Non-null only after bonuses actually credited. Idempotent guard.
  bonus_granted_at timestamptz,
  bonus_amount integer not null default 20000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One referral record per referee — a user can only be referred once.
create unique index if not exists idx_user_referrals_referee_unique
  on public.user_referrals (referee_user_id);

create index if not exists idx_user_referrals_referrer
  on public.user_referrals (referrer_user_id);

create index if not exists idx_user_referrals_status
  on public.user_referrals (status, created_at desc);

comment on table public.user_referrals is
  'Referral history: who referred whom, and whether the 20,000-token bonus has been granted.';


-- FILE: 20260505000000_postcard_sends.sql

-- Animated e-postcards for sphere outreach.
--
-- Real-estate sphere outreach is dominated by plain-text "just
-- checking in" email that gets ignored. This introduces delightful
-- HTML/CSS-animated postcards the agent can send via email, SMS, or
-- WeChat (pending JV). Each send has a unique public slug; the link
-- opens a viewer page, the animation plays, agent's personal message
-- fades in, CTAs offer to call / text / reply.
--
-- Templates themselves live in TypeScript code — static, curated,
-- updated on deploy. We only persist sends.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.postcard_sends (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        -- Which curated template this send uses. Keys live in
        -- lib/postcards/templates.ts.
        template_key text not null,

        -- Public URL slug. 14 URL-safe chars → 62^14 keyspace = plenty
        -- even for heavy senders. Unique + indexed for the public GET.
        slug text not null unique,

        -- Denormalized recipient contact at send-time. Keeps the card
        -- correct even if the contact row is later edited.
        recipient_name text not null,
        recipient_email text,
        recipient_phone text,

        -- Agent's custom message rendered after the animation.
        -- NULL → use the template default copy.
        personal_message text,

        -- Channels requested at send time. Array of
        -- 'email' | 'sms' | 'wechat'. Delivery status per channel
        -- lives in separate timestamp columns below.
        channels text[] not null default array[]::text[],

        email_sent_at timestamptz,
        sms_sent_at timestamptz,
        wechat_sent_at timestamptz,
        email_error text,
        sms_error text,
        wechat_error text,

        -- First time the public viewer page was loaded. Stays null
        -- until the recipient opens the card.
        opened_at timestamptz,
        open_count integer not null default 0,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.postcard_sends (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        template_key text not null,
        slug text not null unique,

        recipient_name text not null,
        recipient_email text,
        recipient_phone text,

        personal_message text,
        channels text[] not null default array[]::text[],

        email_sent_at timestamptz,
        sms_sent_at timestamptz,
        wechat_sent_at timestamptz,
        email_error text,
        sms_error text,
        wechat_error text,

        opened_at timestamptz,
        open_count integer not null default 0,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_postcard_sends_agent_created
  on public.postcard_sends (agent_id, created_at desc);

create index if not exists idx_postcard_sends_contact
  on public.postcard_sends (contact_id, created_at desc)
  where contact_id is not null;

create index if not exists idx_postcard_sends_slug
  on public.postcard_sends (slug);


-- FILE: 20260506000000_agent_profiles_sales_model.sql

-- Sales Model System — agent_profiles table.
--
-- Stores each agent's chosen sales-model identity (Influencer, Closer,
-- Advisor, Custom). The selection drives the dashboard's identity
-- block, daily action plan, model-specific tools, script-generator
-- tone, and pipeline stages — see lib/sales-models.ts for the
-- canonical config the values map to.
--
-- One row per auth user; `user_id` is the natural key (not agent_id —
-- agents may share a single auth user during dev). Upserts on user_id
-- so flipping models is a no-churn operation.
--
-- The CHECK constraint mirrors the SalesModelId TypeScript union so
-- a bad client write fails at the database, not just at the typescript
-- compile step.

create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sales_model text
    check (sales_model in ('influencer', 'closer', 'advisor', 'custom')),
  sales_model_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce one profile per user. We upsert on user_id, so this also
-- protects the upsert from accidentally inserting duplicates if a
-- racing request lands first.
create unique index if not exists agent_profiles_user_id_key
  on public.agent_profiles(user_id);

-- Auto-touch updated_at on every row update so we never have to
-- remember to set it from the application layer.
create or replace function public.set_agent_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_profiles_set_updated_at on public.agent_profiles;
create trigger agent_profiles_set_updated_at
  before update on public.agent_profiles
  for each row execute procedure public.set_agent_profiles_updated_at();

-- RLS: each agent reads + writes their own row only. The service-role
-- helpers in lib/sales-model-server.ts bypass RLS (they're called from
-- API routes that have already authenticated the user), but we still
-- want the policy in place for any future client-direct queries.
alter table public.agent_profiles enable row level security;

drop policy if exists "agent_profiles_select_own" on public.agent_profiles;
create policy "agent_profiles_select_own"
  on public.agent_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "agent_profiles_insert_own" on public.agent_profiles;
create policy "agent_profiles_insert_own"
  on public.agent_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "agent_profiles_update_own" on public.agent_profiles;
create policy "agent_profiles_update_own"
  on public.agent_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- FILE: 20260507000000_missed_call_textback.sql

-- Missed-call text-back + voice forwarding foundation.
--
-- Adds three pieces:
--
-- 1. agents.forwarding_phone — the agent's personal mobile number.
--    Used by both this feature (inbound calls forward to it) and the
--    upcoming click-to-call feature (Twilio dials this first, then
--    bridges to the lead). Storing on `agents` instead of a separate
--    table because it's a property of the agent, not a per-feature
--    config — and other voice features (ringless, voicemail drop)
--    will want it too.
--
-- 2. missed_call_settings — per-agent on/off + customizable message
--    template + ring-timeout. One row per agent, upsert pattern.
--
-- 3. call_logs — single source of truth for inbound + outbound call
--    history (also used by power dialer). Captures Twilio call SIDs,
--    direction, status, duration, optional contact link. Lets the
--    settings page show a "recent missed calls" activity log without
--    a second table.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — see
-- 20260473100000_agent_ai_settings.sql for the established pattern.

-- ── 1. agents.forwarding_phone ───────────────────────────────────

alter table public.agents
  add column if not exists forwarding_phone text;

comment on column public.agents.forwarding_phone is
  'Agent''s personal mobile number for inbound call forwarding and outbound click-to-call. Stored as raw input; normalized at use time.';

-- ── 2. missed_call_settings + 3. call_logs ───────────────────────
--
-- Both tables FK on agents.id, so the table shape branches on the
-- detected agent_id type. Indexes/triggers/policies are added after
-- the do-block since they're type-agnostic.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.missed_call_settings (
        agent_id uuid primary key references public.agents(id) on delete cascade,
        enabled boolean not null default false,
        ring_timeout_seconds int not null default 20
          check (ring_timeout_seconds between 5 and 60),
        message_template text not null default
          'Hey {{caller_name}} — {{agent_first_name}} here. Sorry I missed your call. What''s the best way I can help? Happy to text or set up a quick call back.',
        use_ai_personalization boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.call_logs (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,
        twilio_call_sid text,
        parent_call_sid text,
        direction text not null
          check (direction in ('inbound', 'outbound')),
        status text not null,
        from_phone text,
        to_phone text,
        duration_seconds int,
        recording_url text,
        textback_message_log_id uuid,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.missed_call_settings (
        agent_id bigint primary key references public.agents(id) on delete cascade,
        enabled boolean not null default false,
        ring_timeout_seconds int not null default 20
          check (ring_timeout_seconds between 5 and 60),
        message_template text not null default
          'Hey {{caller_name}} — {{agent_first_name}} here. Sorry I missed your call. What''s the best way I can help? Happy to text or set up a quick call back.',
        use_ai_personalization boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.call_logs (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,
        twilio_call_sid text,
        parent_call_sid text,
        direction text not null
          check (direction in ('inbound', 'outbound')),
        status text not null,
        from_phone text,
        to_phone text,
        duration_seconds int,
        recording_url text,
        textback_message_log_id uuid,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for missed_call_textback: %', v_agent_type;
  end if;
end $$;

-- Token reference for missed_call_settings.message_template:
--   {{caller_name}}      → contact name if known, else "there"
--   {{agent_first_name}} → from agents.full_name
--   {{agent_brand}}      → brand name when set, else first name
-- use_ai_personalization=true: when caller is a known contact, draft
-- via OpenAI using the agent's selected sales-model tone; falls back
-- to message_template on AI error/quota.

comment on table public.missed_call_settings is
  'Per-agent missed-call text-back configuration. One row per agent.';

comment on table public.call_logs is
  'Inbound + outbound call history. One row per call leg from Twilio. Powers the missed-call activity log + power-dialer history.';

-- ── triggers + indexes (type-agnostic) ───────────────────────────

create or replace function public.set_missed_call_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists missed_call_settings_set_updated_at on public.missed_call_settings;
create trigger missed_call_settings_set_updated_at
  before update on public.missed_call_settings
  for each row execute procedure public.set_missed_call_settings_updated_at();

create or replace function public.set_call_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists call_logs_set_updated_at on public.call_logs;
create trigger call_logs_set_updated_at
  before update on public.call_logs
  for each row execute procedure public.set_call_logs_updated_at();

create index if not exists idx_call_logs_agent_created
  on public.call_logs(agent_id, created_at desc);
create index if not exists idx_call_logs_contact_created
  on public.call_logs(contact_id, created_at desc);
create index if not exists idx_call_logs_twilio_sid
  on public.call_logs(twilio_call_sid);

-- ── RLS (type-agnostic — comparisons work for either underlying type) ──

alter table public.missed_call_settings enable row level security;

drop policy if exists "missed_call_settings_select_own" on public.missed_call_settings;
create policy "missed_call_settings_select_own"
  on public.missed_call_settings
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = missed_call_settings.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "missed_call_settings_insert_own" on public.missed_call_settings;
create policy "missed_call_settings_insert_own"
  on public.missed_call_settings
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = missed_call_settings.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "missed_call_settings_update_own" on public.missed_call_settings;
create policy "missed_call_settings_update_own"
  on public.missed_call_settings
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = missed_call_settings.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = missed_call_settings.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

alter table public.call_logs enable row level security;

drop policy if exists "call_logs_select_own" on public.call_logs;
create policy "call_logs_select_own"
  on public.call_logs
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = call_logs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260508000000_agent_lead_routing.sql

-- Per-agent IDX lead-routing rules.
--
-- Promotes the env-allowlist scaffold (IDX_ROUND_ROBIN_AGENT_IDS +
-- IDX_AGENT_ZIP_COVERAGE) to a DB-backed, agent-owned config so each
-- agent can self-serve their pool enrollment + ZIP coverage from the
-- settings UI.
--
-- One row per agent (PK on agent_id). Schema:
--   in_round_robin   bool  — opt into the round-robin pool
--   zip_coverage     text[] — 5-digit ZIPs this agent services. Empty
--                              array means "any ZIP" (the picker treats
--                              missing/empty coverage as no constraint).
--   priority         int   — reserved for future weighted round-robin.
--                              0 = standard pool. Higher = preferred slot
--                              (skip ahead in rotation). Default 0.
--
-- Resolution order in lib/leadAssignment/service.ts becomes:
--   1. DB rows where in_round_robin=true (this table)
--   2. env IDX_ROUND_ROBIN_AGENT_IDS (back-compat fallback)
--   3. env IDX_DEMO_AGENT_ID (single-agent demo fallback)
--   4. unassigned
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same pattern
-- as 20260507000000_missed_call_textback.sql.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.agent_lead_routing (
        agent_id uuid primary key references public.agents(id) on delete cascade,
        in_round_robin boolean not null default false,
        zip_coverage text[] not null default '{}',
        priority int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_lead_routing (
        agent_id bigint primary key references public.agents(id) on delete cascade,
        in_round_robin boolean not null default false,
        zip_coverage text[] not null default '{}',
        priority int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_lead_routing: %', v_agent_type;
  end if;
end $$;

comment on table public.agent_lead_routing is
  'Per-agent IDX lead-routing rules. One row per agent. Replaces env-allowlist scaffold (IDX_ROUND_ROBIN_AGENT_IDS / IDX_AGENT_ZIP_COVERAGE) with self-serve UI-backed config. Env still acts as a fallback when no rows have in_round_robin=true.';

comment on column public.agent_lead_routing.in_round_robin is
  'When true, this agent is included in the IDX round-robin assignment pool.';

comment on column public.agent_lead_routing.zip_coverage is
  '5-digit US ZIPs this agent services. Empty array = no ZIP constraint (eligible for any lead). Non-empty array narrows the pool when the lead has a ZIP that matches.';

comment on column public.agent_lead_routing.priority is
  'Reserved for future weighted round-robin. 0 = standard pool. Higher = preferred (assigned first when timestamps tie). Currently unused by the picker.';

-- ── triggers + indexes ───────────────────────────────────────────

create or replace function public.set_agent_lead_routing_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_lead_routing_set_updated_at on public.agent_lead_routing;
create trigger agent_lead_routing_set_updated_at
  before update on public.agent_lead_routing
  for each row execute procedure public.set_agent_lead_routing_updated_at();

-- Lookup pattern: load all agents in the pool. Filter on in_round_robin=true,
-- order by priority desc for the future weighted-rotation slot. Tiny table —
-- one row per agent — so the index isn't load-bearing today. Adding it
-- defensively for the day someone tries to scope this query in a join.
create index if not exists idx_agent_lead_routing_pool
  on public.agent_lead_routing (in_round_robin, priority desc)
  where in_round_robin = true;

-- ── RLS — agent can read/write their own row ─────────────────────

alter table public.agent_lead_routing enable row level security;

drop policy if exists "agent_lead_routing_select_own" on public.agent_lead_routing;
create policy "agent_lead_routing_select_own"
  on public.agent_lead_routing
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_lead_routing_insert_own" on public.agent_lead_routing;
create policy "agent_lead_routing_insert_own"
  on public.agent_lead_routing
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_lead_routing_update_own" on public.agent_lead_routing;
create policy "agent_lead_routing_update_own"
  on public.agent_lead_routing
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_lead_routing_delete_own" on public.agent_lead_routing;
create policy "agent_lead_routing_delete_own"
  on public.agent_lead_routing
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260509000000_sphere_drip_enrollments.sql

-- Smart-list sphere drip enrollments.
--
-- The sphere monetization view (PR #163) surfaces "both_high" leverage
-- contacts — past clients / sphere who score high on BOTH the seller-
-- prediction and buyer-prediction engines (concurrent sell-then-buy
-- candidates). This table tracks which of those contacts have been
-- auto-enrolled into a structured 6-touch nurture cadence so the
-- agent can work them systematically instead of from a flat list.
--
-- One row per (agent, contact, cadence_key). The unique index ensures
-- re-running the auto-enroll cron is idempotent — a contact already
-- enrolled stays in the same state without producing a duplicate row.
--
-- Send pipeline is OUT-OF-SCOPE for this migration. This table tracks
-- enrollment + step + next-due-at; the actual touch send (SMS / email
-- via the existing scheduler / drafts pipeline) will land in a
-- follow-up PR. Today the agent acts on next_due_at manually.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260508000000_agent_lead_routing.sql.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.sphere_drip_enrollments (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,
        cadence_key text not null,
        enrolled_at timestamptz not null default now(),
        current_step int not null default 0
          check (current_step >= 0 and current_step <= 100),
        status text not null default 'active'
          check (status in ('active', 'paused', 'completed', 'exited')),
        last_sent_at timestamptz,
        next_due_at timestamptz,
        completed_at timestamptz,
        exit_reason text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, contact_id, cadence_key)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.sphere_drip_enrollments (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,
        cadence_key text not null,
        enrolled_at timestamptz not null default now(),
        current_step int not null default 0
          check (current_step >= 0 and current_step <= 100),
        status text not null default 'active'
          check (status in ('active', 'paused', 'completed', 'exited')),
        last_sent_at timestamptz,
        next_due_at timestamptz,
        completed_at timestamptz,
        exit_reason text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, contact_id, cadence_key)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for sphere_drip_enrollments: %', v_agent_type;
  end if;
end $$;

comment on table public.sphere_drip_enrollments is
  'Per-(agent, contact, cadence) sphere-drip enrollment state. Tracks current step + next-due-at for systematic nurture of the both_high cohort surfaced by the sphere-monetization view.';

comment on column public.sphere_drip_enrollments.cadence_key is
  'Identifier for the cadence definition. Today: "both_high_v1" (6 steps over ~30 days). Pinning the version so a future v2 cadence can coexist.';

comment on column public.sphere_drip_enrollments.current_step is
  'Zero-based index of the next step to send. 0 = enrolled but no touch yet. Equals total step count when status=completed.';

comment on column public.sphere_drip_enrollments.status is
  'active = working through steps. paused = agent manually held. completed = all steps sent. exited = removed from cohort (manual or via auto-exit when contact leaves both_high).';

-- ── triggers + indexes ───────────────────────────────────────────

create or replace function public.set_sphere_drip_enrollments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sphere_drip_enrollments_set_updated_at on public.sphere_drip_enrollments;
create trigger sphere_drip_enrollments_set_updated_at
  before update on public.sphere_drip_enrollments
  for each row execute procedure public.set_sphere_drip_enrollments_updated_at();

-- The send pipeline (when wired) will scan for due enrollments via
-- this index. Active rows only — completed / exited / paused don't
-- need to be looked at on every tick.
create index if not exists idx_sphere_drip_enrollments_due
  on public.sphere_drip_enrollments (next_due_at, agent_id)
  where status = 'active';

create index if not exists idx_sphere_drip_enrollments_agent_contact
  on public.sphere_drip_enrollments (agent_id, contact_id);

-- ── RLS ──────────────────────────────────────────────────────────

alter table public.sphere_drip_enrollments enable row level security;

drop policy if exists "sphere_drip_enrollments_select_own" on public.sphere_drip_enrollments;
create policy "sphere_drip_enrollments_select_own"
  on public.sphere_drip_enrollments
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "sphere_drip_enrollments_insert_own" on public.sphere_drip_enrollments;
create policy "sphere_drip_enrollments_insert_own"
  on public.sphere_drip_enrollments
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "sphere_drip_enrollments_update_own" on public.sphere_drip_enrollments;
create policy "sphere_drip_enrollments_update_own"
  on public.sphere_drip_enrollments
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "sphere_drip_enrollments_delete_own" on public.sphere_drip_enrollments;
create policy "sphere_drip_enrollments_delete_own"
  on public.sphere_drip_enrollments
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260510000000_inbound_contact_requests.sql

-- Audit table for public-form contact requests + SMS opt-in records.
--
-- Backs the consent record TCPA expects: every public submission that
-- ticks the SMS opt-in checkbox produces a row here pinned to the EXACT
-- disclosure text shown at submit time, the timestamp, the IP, and the
-- user agent. If a regulator or carrier asks "show me proof this number
-- consented to your messages on date X," the row + the
-- `consent_disclosure_version` is the answer.
--
-- The /contact form (PR #168) is the first writer; future public forms
-- (open-house signin, IDX lead-capture) should write here too as their
-- own follow-up PRs land. The `source` column distinguishes them.
--
-- RLS posture:
--   - Service-role inserts (server-side, via supabaseAdmin). The form
--     route is the only writer.
--   - No public SELECT policies — audit data is sensitive (IP address,
--     full message body). Admin-only reads via service role; an agent
--     dashboard could grow a per-tenant view later if needed.

create table if not exists public.inbound_contact_requests (
  id uuid primary key default gen_random_uuid(),

  -- Where the submission came from. Stable identifier — keep it short
  -- and machine-friendly so it's easy to filter on.
  source text not null,

  -- Submitted fields. All optional except source — different forms
  -- collect different combinations.
  name text,
  email text,
  phone text,
  subject text,
  message text,

  -- Consent flags. sms_consent is the load-bearing one for TCPA;
  -- email_consent is captured when a form has a separate checkbox
  -- (today the /contact form doesn't, so it's null there).
  sms_consent boolean not null default false,
  email_consent boolean,

  -- Identifies the EXACT disclosure copy that was on screen at submit.
  -- Bump the version whenever the disclosure text changes materially.
  -- Stored here (not derived) so we can prove what the consenting party
  -- saw even if the live form has since been edited.
  consent_disclosure_version text,

  -- Audit metadata.
  ip_address text,
  user_agent text,

  -- Optional link to a CRM contact that was created/matched from this
  -- submission. Null when no contact was created (e.g. the /contact
  -- form's email-only intake today). Set when a future PR wires the
  -- public form to upsert into contacts.
  contact_id uuid references public.contacts(id) on delete set null,

  created_at timestamptz not null default now()
);

comment on table public.inbound_contact_requests is
  'Public-form submissions + SMS/email consent audit. TCPA-required record of who consented to receive messages, when, and what disclosure they saw. Service-role writes only.';

comment on column public.inbound_contact_requests.source is
  'Stable identifier for the form that produced this row. Examples: "/contact", "/oh/<slug>", "/api/idx/lead-capture".';

comment on column public.inbound_contact_requests.consent_disclosure_version is
  'Version tag for the exact disclosure text shown at submit. Bump when the disclosure changes materially. The current /contact form ships v1.0_2026-04-27.';

-- Lookup patterns:
--   1. "Has this phone number ever consented?" — index on phone where consent=true
--   2. "Show me the audit trail for this email" — index on email
--   3. "Pull all submissions in a date range" — index on created_at
create index if not exists idx_inbound_contact_requests_phone_consent
  on public.inbound_contact_requests (phone)
  where sms_consent = true;

create index if not exists idx_inbound_contact_requests_email
  on public.inbound_contact_requests (email);

create index if not exists idx_inbound_contact_requests_created_at
  on public.inbound_contact_requests (created_at desc);

-- ── RLS — admin-only by default (no public SELECT policies) ──────

alter table public.inbound_contact_requests enable row level security;

-- The form route uses supabaseAdmin (service role bypasses RLS for
-- writes). No anon-key INSERT policy is needed; deliberately omitting
-- one keeps the audit table immune from client-side tampering even if
-- the anon key leaks.


-- FILE: 20260511000000_cma_reports.sql

-- CMA (Comparative Market Analysis) reports per agent.
--
-- The actual valuation engine + comp pipeline lives in the
-- propertytoolsai app (lib/valuation/* and /api/smart-cma). This table
-- captures the OUTPUT of one of those runs as a snapshot owned by an
-- agent in the CRM, so the agent can:
--   * Browse historical CMAs (one row per generation event)
--   * Re-show a past CMA to a seller without re-running it
--   * Optionally link the CMA to a contact (the seller-prospect)
--
-- We intentionally don't normalize comps into their own rows — they
-- live as a JSON snapshot inside `comps_json` so the report stays
-- frozen even if the underlying property warehouse data shifts. The
-- denormalized columns (estimated_value, low_estimate, etc.) exist
-- so the list view can sort/filter without parsing JSON.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260510000000_inbound_contact_requests.sql etc.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.cma_reports (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        -- Subject + comps + valuation snapshots (JSON for stability against
        -- upstream property-warehouse churn).
        subject_address text not null,
        subject_json jsonb not null,
        comps_json jsonb not null,
        valuation_json jsonb not null,
        strategies_json jsonb,

        -- Denormalized for list-view sort/filter without JSON parsing.
        estimated_value numeric(15, 2),
        low_estimate numeric(15, 2),
        high_estimate numeric(15, 2),
        confidence_score int,
        comp_count int not null default 0,

        title text,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.cma_reports (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        subject_address text not null,
        subject_json jsonb not null,
        comps_json jsonb not null,
        valuation_json jsonb not null,
        strategies_json jsonb,

        estimated_value numeric(15, 2),
        low_estimate numeric(15, 2),
        high_estimate numeric(15, 2),
        confidence_score int,
        comp_count int not null default 0,

        title text,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for cma_reports: %', v_agent_type;
  end if;
end $$;

comment on table public.cma_reports is
  'Per-agent Comparative Market Analysis snapshots. The valuation engine + comps live in propertytoolsai/lib/valuation; this table snapshots one run for the agent to retain, share, and link to a seller-prospect contact.';

comment on column public.cma_reports.subject_json is
  'Subject property snapshot at the time of the CMA run: address, beds, baths, sqft, year_built, condition, etc.';

comment on column public.cma_reports.comps_json is
  'Array of comparable sales the engine selected, frozen at the time of the run. Each entry: address, price, sqft, beds, baths, distanceMiles, soldDate, propertyType, pricePerSqft.';

comment on column public.cma_reports.valuation_json is
  'Top-level valuation result: estimatedValue, low, high, avgPricePerSqft, plus any engine metadata.';

comment on column public.cma_reports.strategies_json is
  'Listing-strategy bands the engine returned (aggressive / market / premium with daysOnMarket projections). Optional — older runs may not include this.';

-- ── triggers + indexes ──────────────────────────────────────────

create or replace function public.set_cma_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cma_reports_set_updated_at on public.cma_reports;
create trigger cma_reports_set_updated_at
  before update on public.cma_reports
  for each row execute procedure public.set_cma_reports_updated_at();

create index if not exists idx_cma_reports_agent_created
  on public.cma_reports (agent_id, created_at desc);

create index if not exists idx_cma_reports_contact
  on public.cma_reports (contact_id)
  where contact_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.cma_reports enable row level security;

drop policy if exists "cma_reports_select_own" on public.cma_reports;
create policy "cma_reports_select_own"
  on public.cma_reports
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "cma_reports_insert_own" on public.cma_reports;
create policy "cma_reports_insert_own"
  on public.cma_reports
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "cma_reports_update_own" on public.cma_reports;
create policy "cma_reports_update_own"
  on public.cma_reports
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "cma_reports_delete_own" on public.cma_reports;
create policy "cma_reports_delete_own"
  on public.cma_reports
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260512000000_agent_sphere_drip_prefs.sql

-- Per-agent sphere-drip enrollment toggle.
--
-- Promotes the env-allowlist scaffold (SPHERE_DRIP_ENABLED_AGENT_IDS)
-- to a DB-backed per-agent flag. PR #167 / #169 shipped the drip
-- enrollment + send pipelines; this migration removes the redeploy
-- friction so agents can flip themselves into / out of the cadence
-- from a settings panel without env changes.
--
-- Resolution order in lib/sphereDrip/runEnrollments.ts +
-- lib/sphereDrip/runSends.ts becomes:
--   1. DB rows where enabled = true (this table) — preferred
--   2. SPHERE_DRIP_ENABLED_AGENT_IDS env (back-compat fallback)
--   3. nothing — agent skipped
--
-- Migration is non-breaking: existing env-driven setups keep enrolling
-- contacts + sending touches exactly as before. The DB takes over the
-- moment any agent toggles "Enable sphere drip" via the UI.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260508000000_agent_lead_routing.sql.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.agent_sphere_drip_prefs (
        agent_id uuid primary key references public.agents(id) on delete cascade,
        enabled boolean not null default false,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_sphere_drip_prefs (
        agent_id bigint primary key references public.agents(id) on delete cascade,
        enabled boolean not null default false,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_sphere_drip_prefs: %', v_agent_type;
  end if;
end $$;

comment on table public.agent_sphere_drip_prefs is
  'Per-agent toggle for sphere-drip auto-enrollment + send pipeline. Replaces SPHERE_DRIP_ENABLED_AGENT_IDS env allowlist (env still acts as a back-compat fallback when no DB rows are enabled).';

comment on column public.agent_sphere_drip_prefs.enabled is
  'When true, the agent is included in /api/cron/sphere-drip-enroll runs (auto-enroll both_high contacts) AND /api/cron/sphere-drip-send runs (advance the cadence). Off by default — explicit opt-in.';

comment on column public.agent_sphere_drip_prefs.notes is
  'Free-text agent note about why they enabled / paused (e.g. "trying for Q3", "paused while on vacation"). Surfaced read-only on the settings panel.';

-- ── trigger + index ─────────────────────────────────────────────

create or replace function public.set_agent_sphere_drip_prefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_sphere_drip_prefs_set_updated_at on public.agent_sphere_drip_prefs;
create trigger agent_sphere_drip_prefs_set_updated_at
  before update on public.agent_sphere_drip_prefs
  for each row execute procedure public.set_agent_sphere_drip_prefs_updated_at();

-- The cron loop scans for enabled=true rows. Tiny table (one row per
-- agent) so the index isn't load-bearing today, but defensive vs.
-- future joins.
create index if not exists idx_agent_sphere_drip_prefs_enabled
  on public.agent_sphere_drip_prefs (enabled)
  where enabled = true;

-- ── RLS — agent reads/writes their own row only ──────────────────

alter table public.agent_sphere_drip_prefs enable row level security;

drop policy if exists "agent_sphere_drip_prefs_select_own" on public.agent_sphere_drip_prefs;
create policy "agent_sphere_drip_prefs_select_own"
  on public.agent_sphere_drip_prefs
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_sphere_drip_prefs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_sphere_drip_prefs_insert_own" on public.agent_sphere_drip_prefs;
create policy "agent_sphere_drip_prefs_insert_own"
  on public.agent_sphere_drip_prefs
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_sphere_drip_prefs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_sphere_drip_prefs_update_own" on public.agent_sphere_drip_prefs;
create policy "agent_sphere_drip_prefs_update_own"
  on public.agent_sphere_drip_prefs
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_sphere_drip_prefs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_sphere_drip_prefs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260513000000_contacts_claimed_at.sql

-- Re-add claimed_at to public.contacts.
--
-- The original lead-queue migration (20260474000000_lead_queue.sql)
-- added `claimed_at timestamptz` to the now-defunct `public.leads`
-- table. The leads → contacts consolidation
-- (20260480100000_contacts_consolidation_create.sql) didn't carry that
-- column over, but the two write paths
--   * /api/dashboard/lead-queue/claim    (agent claims an unassigned lead)
--   * /api/admin/lead-queue/assign       (support staff assigns to an agent)
-- still stamp it. Without this column the writes fail with
-- "Could not find the 'claimed_at' column of 'contacts' in the schema
-- cache" and the lead never gets claimed.
--
-- Field semantics: timestamp the contact was first claimed from the
-- unassigned pool (where agent_id IS NULL). One-shot — once a lead is
-- claimed, claimed_at stays put; subsequent reassignments DON'T update
-- it (those routes filter on `is agent_id null` so the row is no
-- longer eligible anyway).

alter table public.contacts
  add column if not exists claimed_at timestamptz;

comment on column public.contacts.claimed_at is
  'Timestamp the lead was claimed from the unassigned pool (agent_id IS NULL). Set by /api/dashboard/lead-queue/claim and /api/admin/lead-queue/assign. One-shot — never updated after the initial claim.';

-- Partial index supports a future "recently claimed" admin query
-- without scanning all of contacts. Tiny on the partial filter so
-- the cost of carrying it is negligible.
create index if not exists idx_contacts_claimed_at
  on public.contacts (claimed_at desc)
  where claimed_at is not null;


-- FILE: 20260514000000_agent_social_connections.sql

-- Per-agent social connections + post audit log.
--
-- v1 scope: Facebook Page posting only. The schema is provider-agnostic
-- (provider text + provider_account_id text) so adding Instagram or
-- LinkedIn later is a TS-side change, not a migration.
--
-- agent_social_connections: one row per (agent, provider, account).
--   An agent can connect MULTIPLE FB pages; each is a row. The picker on
--   the post UI lets the agent choose which page to post to. RLS is
--   strict — only the owning agent reads/writes their own rows.
--
-- social_post_log: every post attempt, success or failure. Append-only;
--   feeds the audit / "did this go through?" panel on the transaction
--   detail page. No cascade-delete to transactions because the audit
--   should outlive the deal.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260512000000_agent_sphere_drip_prefs.sql.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.agent_social_connections (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        provider text not null check (provider in ('facebook_page')),
        provider_account_id text not null,
        provider_account_name text,
        access_token text not null,
        token_expires_at timestamptz,
        scopes text[] not null default '{}',
        connected_at timestamptz not null default now(),
        last_used_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, provider, provider_account_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.social_post_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        connection_id uuid references public.agent_social_connections(id) on delete set null,
        provider text not null,
        provider_account_id text,
        provider_post_id text,
        transaction_id uuid references public.transactions(id) on delete set null,
        caption text,
        status text not null check (status in ('pending', 'sent', 'failed')),
        error text,
        created_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_social_connections (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        provider text not null check (provider in ('facebook_page')),
        provider_account_id text not null,
        provider_account_name text,
        access_token text not null,
        token_expires_at timestamptz,
        scopes text[] not null default '{}',
        connected_at timestamptz not null default now(),
        last_used_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, provider, provider_account_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.social_post_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        connection_id uuid references public.agent_social_connections(id) on delete set null,
        provider text not null,
        provider_account_id text,
        provider_post_id text,
        transaction_id uuid references public.transactions(id) on delete set null,
        caption text,
        status text not null check (status in ('pending', 'sent', 'failed')),
        error text,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.agent_social_connections is
  'OAuth credentials for posting to social platforms on behalf of an agent. v1 supports Facebook Pages; the provider column is open-ended for future Instagram / LinkedIn additions.';

comment on column public.agent_social_connections.access_token is
  'Long-lived FB Page access token (60-day rolling). Never returned to the client; only the server uses it to call the Graph API. RLS prevents cross-agent reads.';

comment on column public.agent_social_connections.revoked_at is
  'Set when the agent disconnects the account. Disconnect sets the timestamp without deleting the row, so the social_post_log audit trail still resolves the connection_id FK.';

comment on table public.social_post_log is
  'Append-only audit of every post attempt. status=pending is a defensive default; the post helper updates to sent/failed before returning to the caller.';

-- ── triggers ────────────────────────────────────────────────────

create or replace function public.set_agent_social_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_social_connections_set_updated_at on public.agent_social_connections;
create trigger agent_social_connections_set_updated_at
  before update on public.agent_social_connections
  for each row execute procedure public.set_agent_social_connections_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_agent_social_connections_agent_active
  on public.agent_social_connections (agent_id, provider)
  where revoked_at is null;

create index if not exists idx_social_post_log_agent_created
  on public.social_post_log (agent_id, created_at desc);

create index if not exists idx_social_post_log_transaction
  on public.social_post_log (transaction_id, created_at desc)
  where transaction_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.agent_social_connections enable row level security;

drop policy if exists "agent_social_connections_select_own" on public.agent_social_connections;
create policy "agent_social_connections_select_own"
  on public.agent_social_connections
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_social_connections_insert_own" on public.agent_social_connections;
create policy "agent_social_connections_insert_own"
  on public.agent_social_connections
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_social_connections_update_own" on public.agent_social_connections;
create policy "agent_social_connections_update_own"
  on public.agent_social_connections
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_social_connections_delete_own" on public.agent_social_connections;
create policy "agent_social_connections_delete_own"
  on public.agent_social_connections
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

-- social_post_log is append-only from the agent's perspective; reads
-- only. The server writes via service-role to bypass RLS for inserts.
alter table public.social_post_log enable row level security;

drop policy if exists "social_post_log_select_own" on public.social_post_log;
create policy "social_post_log_select_own"
  on public.social_post_log
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = social_post_log.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260515000000_coaching_dismissals.sql

-- Per-agent coaching insight dismissals.
--
-- The coaching dashboard (PR #175) surfaces 5 nudges. Without a way to
-- snooze them, agents see the same "you have 8 stale past clients"
-- card every visit even after they've acknowledged it. This table
-- stores per-agent, per-insight TTL dismissals so the service-side
-- filter can hide an insight until the timestamp passes.
--
-- One row per (agent, insight_id). Re-dismissing the same insight
-- updates `dismissed_until` in place via upsert.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260514000000_agent_social_connections.sql.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.coaching_dismissals (
        agent_id uuid not null references public.agents(id) on delete cascade,
        insight_id text not null,
        dismissed_until timestamptz not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (agent_id, insight_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.coaching_dismissals (
        agent_id bigint not null references public.agents(id) on delete cascade,
        insight_id text not null,
        dismissed_until timestamptz not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (agent_id, insight_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.coaching_dismissals is
  'Per-agent TTL snooze for coaching-dashboard insights. PK on (agent_id, insight_id) enforces one row per insight per agent; upsert refreshes dismissed_until on re-snooze.';

comment on column public.coaching_dismissals.dismissed_until is
  'When this insight becomes visible again. The service-side filter compares against now() and excludes dismissed insights from the response.';

-- ── trigger ─────────────────────────────────────────────────────

create or replace function public.set_coaching_dismissals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coaching_dismissals_set_updated_at on public.coaching_dismissals;
create trigger coaching_dismissals_set_updated_at
  before update on public.coaching_dismissals
  for each row execute procedure public.set_coaching_dismissals_updated_at();

-- ── index ───────────────────────────────────────────────────────

-- The lookup pattern is "for this agent, give me the still-active
-- dismissals." Partial index keeps it small + fast.
create index if not exists idx_coaching_dismissals_active
  on public.coaching_dismissals (agent_id, dismissed_until desc);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.coaching_dismissals enable row level security;

drop policy if exists "coaching_dismissals_select_own" on public.coaching_dismissals;
create policy "coaching_dismissals_select_own"
  on public.coaching_dismissals
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_dismissals_insert_own" on public.coaching_dismissals;
create policy "coaching_dismissals_insert_own"
  on public.coaching_dismissals
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_dismissals_update_own" on public.coaching_dismissals;
create policy "coaching_dismissals_update_own"
  on public.coaching_dismissals
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_dismissals_delete_own" on public.coaching_dismissals;
create policy "coaching_dismissals_delete_own"
  on public.coaching_dismissals
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260516000000_email_events.sql

-- Resend email-event tracking.
--
-- The AI-email layer (lib/ai-email/send.ts) sends through Resend and
-- stores the resulting email_id on email_messages.external_message_id.
-- This table records what happened to those messages downstream:
-- delivered, opened, clicked, bounced, complained.
--
-- Source: Resend webhooks (delivered via Svix). The webhook handler
-- at app/api/webhooks/resend/route.ts verifies the signature, maps
-- the event to a row here, and joins to email_messages to resolve
-- the agent + lead.
--
-- Why a separate events table (vs. columns on email_messages):
--   - One outbound message can have many events (delivered + opened +
--     clicked × 3 + clicked × 5 different URLs). A flat row can't
--     model that without losing the per-link breakdown that makes
--     click tracking useful.
--   - Idempotent ingestion: Svix retries deliver the same event with
--     the same svix-id; the unique constraint on event_id rejects
--     duplicates without bespoke "have I seen this?" checks.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260514000000_agent_social_connections.sql and
-- 20260515000000_coaching_dismissals.sql.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.email_events (
        id uuid primary key default gen_random_uuid(),
        -- Resend's email_id (returned from POST /emails). Joins back
        -- to email_messages.external_message_id to find the agent/lead.
        external_message_id text not null,
        -- Svix delivery id. Unique to dedupe webhook retries.
        event_id text unique,
        agent_id uuid references public.agents(id) on delete set null,
        lead_id bigint,
        event_type text not null check (event_type in (
          'sent','delivered','delayed','opened','clicked','bounced','complained'
        )),
        -- Populated for 'clicked' events. Resend includes the link URL.
        url text,
        metadata jsonb not null default '{}'::jsonb,
        occurred_at timestamptz not null,
        created_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.email_events (
        id uuid primary key default gen_random_uuid(),
        external_message_id text not null,
        event_id text unique,
        agent_id bigint references public.agents(id) on delete set null,
        lead_id bigint,
        event_type text not null check (event_type in (
          'sent','delivered','delayed','opened','clicked','bounced','complained'
        )),
        url text,
        metadata jsonb not null default '{}'::jsonb,
        occurred_at timestamptz not null,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.email_events is
  'Per-event log of Resend email lifecycle (delivered/opened/clicked/etc). One outbound email_messages row can have many events here. Ingested by app/api/webhooks/resend/route.ts.';

comment on column public.email_events.event_id is
  'Svix delivery id (svix-id header). Unique so webhook retries are idempotent — duplicate inserts are rejected silently.';

comment on column public.email_events.url is
  'Click target for event_type=clicked. Null for other event types.';

-- ── indexes ─────────────────────────────────────────────────────

-- Primary lookup pattern: "for this agent, give me email events in a
-- time window for the dashboard / open-rate aggregation."
create index if not exists idx_email_events_agent_occurred
  on public.email_events (agent_id, occurred_at desc);

-- Per-lead timeline ("show every event for this contact").
create index if not exists idx_email_events_lead_occurred
  on public.email_events (lead_id, occurred_at desc);

-- Webhook handler joins on this when looking up agent_id / lead_id
-- from the email_messages row.
create index if not exists idx_email_events_external_id
  on public.email_events (external_message_id);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.email_events enable row level security;

-- Agents can only read their own events. Inserts/updates/deletes are
-- service-role only — the webhook handler runs with the service role
-- and is the sole writer.
drop policy if exists "email_events_select_own" on public.email_events;
create policy "email_events_select_own"
  on public.email_events
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = email_events.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260517000000_teams.sql

-- Team accounts foundation.
--
-- Phase 1 of the multi-PR rollout to support brokerages: a team has
-- one owner and zero-or-more members. Members are also agents — one
-- agent can be in multiple teams (e.g. a buyer-side and listing-side
-- group at the same brokerage).
--
-- This migration only creates the data model. Subsequent PRs:
--   - PR-AA2 wires read queries to use a team-aware scope helper
--   - PR-AA3 ships the team management UI
--   - PR-AA4 routes leads across team rosters
--   - PR-AA5 wires entitlements + Stripe team plans
--   - PR-AA6 adds team-aggregated reporting
--
-- Three tables:
--   - teams: one row per team, owned by exactly one agent
--   - team_memberships: many-to-many between teams and agents (the
--     owner has a row too with role='owner', so "list all members"
--     is one query)
--   - team_invites: pending invitations keyed by invitee email + a
--     signed token. Distinct from memberships so we don't have a
--     nullable agent_id on the membership table — cleaner lifecycle
--
-- agent_id type adapts to public.agents.id (uuid OR bigint), same
-- pattern as 20260514000000_agent_social_connections.sql,
-- 20260515000000_coaching_dismissals.sql,
-- 20260516000000_email_events.sql.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.teams (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        owner_agent_id uuid not null references public.agents(id) on delete cascade,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.team_memberships (
        team_id uuid not null references public.teams(id) on delete cascade,
        agent_id uuid not null references public.agents(id) on delete cascade,
        role text not null default 'member' check (role in ('owner','member')),
        created_at timestamptz not null default now(),
        primary key (team_id, agent_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.team_invites (
        id uuid primary key default gen_random_uuid(),
        team_id uuid not null references public.teams(id) on delete cascade,
        invited_email text not null,
        -- Cryptographically-random token; the accept URL embeds it.
        -- Service layer hashes before comparing on accept to avoid
        -- timing attacks. (Stored hashed; raw token only emailed.)
        token_hash text not null,
        invited_by_agent_id uuid not null references public.agents(id) on delete cascade,
        expires_at timestamptz not null,
        accepted_at timestamptz null,
        accepted_by_agent_id uuid null references public.agents(id) on delete set null,
        created_at timestamptz not null default now(),
        unique (team_id, invited_email)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.teams (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        owner_agent_id bigint not null references public.agents(id) on delete cascade,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.team_memberships (
        team_id uuid not null references public.teams(id) on delete cascade,
        agent_id bigint not null references public.agents(id) on delete cascade,
        role text not null default 'member' check (role in ('owner','member')),
        created_at timestamptz not null default now(),
        primary key (team_id, agent_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.team_invites (
        id uuid primary key default gen_random_uuid(),
        team_id uuid not null references public.teams(id) on delete cascade,
        invited_email text not null,
        token_hash text not null,
        invited_by_agent_id bigint not null references public.agents(id) on delete cascade,
        expires_at timestamptz not null,
        accepted_at timestamptz null,
        accepted_by_agent_id bigint null references public.agents(id) on delete set null,
        created_at timestamptz not null default now(),
        unique (team_id, invited_email)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.teams is
  'Brokerage / agent-team grouping. One owner agent + many members. Owner also has a row in team_memberships (role=owner) so member queries are one table.';

comment on column public.team_invites.token_hash is
  'SHA-256 hex of the raw invite token. Raw token only ever leaves the server in the invite email; verification compares hashes.';

-- ── trigger: keep teams.updated_at fresh ────────────────────────

create or replace function public.set_teams_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute procedure public.set_teams_updated_at();

-- ── trigger: when a team is created, insert the owner's membership ──

create or replace function public.add_owner_team_membership()
returns trigger
language plpgsql
as $$
begin
  insert into public.team_memberships(team_id, agent_id, role)
  values (new.id, new.owner_agent_id, 'owner')
  on conflict (team_id, agent_id) do nothing;
  return new;
end;
$$;

drop trigger if exists teams_add_owner_membership on public.teams;
create trigger teams_add_owner_membership
  after insert on public.teams
  for each row execute procedure public.add_owner_team_membership();

-- ── indexes ─────────────────────────────────────────────────────

-- "give me every team I'm a member of"
create index if not exists idx_team_memberships_agent
  on public.team_memberships (agent_id);

-- "give me the roster of this team"
create index if not exists idx_team_memberships_team
  on public.team_memberships (team_id);

-- "is there a pending invite for this email?"
create index if not exists idx_team_invites_email_pending
  on public.team_invites (invited_email)
  where accepted_at is null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_invites enable row level security;

-- Helper: is the calling agent the owner of <team_id>?
create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.teams t
    join public.agents a on a.id = t.owner_agent_id
    where t.id = p_team_id
      and a.auth_user_id = auth.uid()
  );
$$;

-- Helper: is the calling agent a member (any role) of <team_id>?
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.agents a on a.id = tm.agent_id
    where tm.team_id = p_team_id
      and a.auth_user_id = auth.uid()
  );
$$;

-- ── teams policies ──────────────────────────────────────────────

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member"
  on public.teams
  for select
  using (public.is_team_member(id));

drop policy if exists "teams_insert_self_as_owner" on public.teams;
create policy "teams_insert_self_as_owner"
  on public.teams
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = teams.owner_agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "teams_update_owner" on public.teams;
create policy "teams_update_owner"
  on public.teams
  for update
  using (public.is_team_owner(id))
  with check (public.is_team_owner(id));

drop policy if exists "teams_delete_owner" on public.teams;
create policy "teams_delete_owner"
  on public.teams
  for delete
  using (public.is_team_owner(id));

-- ── team_memberships policies ───────────────────────────────────

-- Members can read their team's full roster (so they know who else is on the team).
drop policy if exists "team_memberships_select_team_members" on public.team_memberships;
create policy "team_memberships_select_team_members"
  on public.team_memberships
  for select
  using (public.is_team_member(team_id));

-- Only the owner can add or remove members directly. (Membership is
-- normally added via accepting an invite, which runs through the
-- service-role server path; this insert policy covers manual
-- direct-add by the owner from a future admin UI.)
drop policy if exists "team_memberships_insert_owner" on public.team_memberships;
create policy "team_memberships_insert_owner"
  on public.team_memberships
  for insert
  with check (public.is_team_owner(team_id));

drop policy if exists "team_memberships_delete_owner" on public.team_memberships;
create policy "team_memberships_delete_owner"
  on public.team_memberships
  for delete
  using (public.is_team_owner(team_id));

-- ── team_invites policies ───────────────────────────────────────

-- Owners see all invites for their team. Members can also see them
-- (so the roster page reads coherently). Invitees never see anything
-- via the agent client — accept-by-token flow goes through the
-- service-role webhook path.
drop policy if exists "team_invites_select_member" on public.team_invites;
create policy "team_invites_select_member"
  on public.team_invites
  for select
  using (public.is_team_member(team_id));

drop policy if exists "team_invites_insert_owner" on public.team_invites;
create policy "team_invites_insert_owner"
  on public.team_invites
  for insert
  with check (public.is_team_owner(team_id));

drop policy if exists "team_invites_delete_owner" on public.team_invites;
create policy "team_invites_delete_owner"
  on public.team_invites
  for delete
  using (public.is_team_owner(team_id));


-- FILE: 20260518000000_signature_envelopes.sql

-- E-signature integration: provider-agnostic envelope tracking.
--
-- Real estate transactions need signed disclosures, agreements,
-- amendments. Today the agent leaves the CRM for DocuSign/Dotloop
-- and copy-pastes status back. This table lets us track sent
-- envelopes inside the CRM, surfaced on the transaction detail
-- page, with status updated via webhook.
--
-- Provider-agnostic by design — `provider` text + `provider_id`
-- text. The first ride-on is Dotloop (the real-estate-native
-- option), but DocuSign / HelloSign can layer in without a schema
-- change.
--
-- Two tables:
--   - signature_envelopes: one row per envelope (the document set
--     sent for signature). Status canonicalized across providers.
--   - signature_events: append-only timeline (sent / viewed / signed
--     by signer X / completed / declined / voided). Same shape
--     used by PR-Z1's email_events.
--
-- agent_id type adapts to public.agents.id (uuid OR bigint), same
-- pattern as recent migrations.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.signature_envelopes (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        provider text not null check (provider in ('dotloop','docusign','hellosign')),
        -- The provider's id for this envelope. Combined with provider,
        -- uniquely identifies the envelope at the source.
        provider_id text not null,
        -- Canonicalized status (mapped from provider-specific statuses).
        status text not null default 'sent' check (status in (
          'sent','viewed','signed','completed','declined','voided','expired'
        )),
        subject text not null default '',
        signers jsonb not null default '[]'::jsonb,
        metadata jsonb not null default '{}'::jsonb,
        sent_at timestamptz null,
        completed_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (provider, provider_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.signature_envelopes (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        provider text not null check (provider in ('dotloop','docusign','hellosign')),
        provider_id text not null,
        status text not null default 'sent' check (status in (
          'sent','viewed','signed','completed','declined','voided','expired'
        )),
        subject text not null default '',
        signers jsonb not null default '[]'::jsonb,
        metadata jsonb not null default '{}'::jsonb,
        sent_at timestamptz null,
        completed_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (provider, provider_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.signature_envelopes is
  'E-signature envelopes sent through Dotloop/DocuSign/HelloSign. Status canonicalized across providers; raw provider payloads land in signature_events.';

create table if not exists public.signature_events (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.signature_envelopes(id) on delete cascade,
  -- Provider's webhook delivery id. Unique to dedupe retries.
  external_event_id text unique,
  event_type text not null check (event_type in (
    'sent','viewed','signed','completed','declined','voided','expired','reminded'
  )),
  -- Index of the signer this event applies to (for 'signed'). Null for envelope-level events.
  signer_index int null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.signature_events is
  'Append-only timeline of e-signature webhook events. Signer-level events carry signer_index; envelope-level events leave it null.';

-- ── trigger: keep updated_at fresh on envelopes ────────────────

create or replace function public.set_signature_envelopes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists signature_envelopes_set_updated_at on public.signature_envelopes;
create trigger signature_envelopes_set_updated_at
  before update on public.signature_envelopes
  for each row execute procedure public.set_signature_envelopes_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_signature_envelopes_agent_status
  on public.signature_envelopes (agent_id, status);

create index if not exists idx_signature_envelopes_transaction
  on public.signature_envelopes (transaction_id)
  where transaction_id is not null;

create index if not exists idx_signature_envelopes_contact
  on public.signature_envelopes (contact_id)
  where contact_id is not null;

create index if not exists idx_signature_events_envelope_occurred
  on public.signature_events (envelope_id, occurred_at desc);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.signature_envelopes enable row level security;
alter table public.signature_events enable row level security;

-- Agents can read their own envelopes. All writes go through the
-- service role (webhook + create-envelope path).
drop policy if exists "signature_envelopes_select_own" on public.signature_envelopes;
create policy "signature_envelopes_select_own"
  on public.signature_envelopes
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = signature_envelopes.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

-- Events follow the parent envelope.
drop policy if exists "signature_events_select_own" on public.signature_events;
create policy "signature_events_select_own"
  on public.signature_events
  for select
  using (
    exists (
      select 1 from public.signature_envelopes e
      join public.agents a on a.id = e.agent_id
      where e.id = signature_events.envelope_id
        and a.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260519000000_tracking_numbers.sql

-- Per-source vanity / call-tracking numbers.
--
-- Each tracking number is a Twilio phone number assigned to a
-- specific marketing source (Zillow Premier, Facebook Ads, "yard
-- sign at 123 Main St", etc.). When inbound voice / SMS hits that
-- number, the inbound handler reads `tracking_numbers.source_label`
-- and stamps the lead's `source` accordingly.
--
-- Pairs with the existing lib/leadSourceRoi/ infra: ROI by source
-- now reflects ACTUAL inbound traffic to each number, not just
-- form attribution. Closes the loop on the gap-analysis "vanity /
-- call-tracking numbers" item.
--
-- Schema notes:
--   - phone_e164 is GLOBALLY unique — Twilio only owns each number
--     once, so two agents can't both claim it
--   - forward_to_phone is optional. When set, the inbound voice
--     route bridges the call to this number; when null, falls back
--     to the agent's own phone (agents.phone or agent_profiles.phone)
--   - is_active lets agents pause a number without deleting it
--
-- agent_id type adapts to public.agents.id (uuid OR bigint).

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.tracking_numbers (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        phone_e164 text not null,
        source_label text not null,
        forward_to_phone text null,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (phone_e164)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.tracking_numbers (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        phone_e164 text not null,
        source_label text not null,
        forward_to_phone text null,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (phone_e164)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.tracking_numbers is
  'Per-source vanity Twilio numbers. Inbound calls/SMS to phone_e164 inherit source_label, feeding lead-source ROI attribution.';

comment on column public.tracking_numbers.forward_to_phone is
  'Optional bridge target. Null = ring the agent''s own phone. E.164 format.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_tracking_numbers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracking_numbers_set_updated_at on public.tracking_numbers;
create trigger tracking_numbers_set_updated_at
  before update on public.tracking_numbers
  for each row execute procedure public.set_tracking_numbers_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

-- "Lookup by phone number" is the inbound hot path — covered by
-- the unique constraint already, no extra index needed.

-- "Show me my numbers" — agent dashboard.
create index if not exists idx_tracking_numbers_agent_active
  on public.tracking_numbers (agent_id, is_active);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.tracking_numbers enable row level security;

drop policy if exists "tracking_numbers_select_own" on public.tracking_numbers;
create policy "tracking_numbers_select_own"
  on public.tracking_numbers
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "tracking_numbers_insert_own" on public.tracking_numbers;
create policy "tracking_numbers_insert_own"
  on public.tracking_numbers
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "tracking_numbers_update_own" on public.tracking_numbers;
create policy "tracking_numbers_update_own"
  on public.tracking_numbers
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "tracking_numbers_delete_own" on public.tracking_numbers;
create policy "tracking_numbers_delete_own"
  on public.tracking_numbers
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260520000000_review_requests.sql

-- Review / testimonial capture.
--
-- Closes the "reviews / testimonial capture" gap. After a
-- transaction closes, the system sends the client a request
-- with two paths:
--   1. Click → leave a Google review (external link)
--   2. Submit a private testimonial (rating + comment) the agent
--      can later use as marketing copy
--
-- Two tables:
--   - review_requests: one row per (agent, contact) pair we asked
--     for a review. Tokenized public link, expires_at gates abuse
--   - testimonials: agent-owned testimonials (response when the
--     client submitted privately, OR manually entered by the agent
--     for a transaction that closed before this feature shipped)
--
-- agent_id type adapts to public.agents.id (uuid OR bigint).

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.review_requests (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        -- Hash of the random token sent in the request URL. Raw
        -- token only ever leaves the server in the email/SMS;
        -- comparison hashes the inbound token before lookup.
        token_hash text not null unique,
        -- Optional public-facing destination for "leave a Google
        -- review" — agent sets this once in Settings.
        google_review_url text null,
        sent_at timestamptz not null default now(),
        expires_at timestamptz not null,
        responded_at timestamptz null,
        clicked_google_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
    execute $sql$
      create table if not exists public.testimonials (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        -- Optional pointer back to the request (null when manually entered)
        request_id uuid null references public.review_requests(id) on delete set null,
        rating int null check (rating between 1 and 5),
        body text not null default '',
        author_name text null,
        author_title text null,
        is_published boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.review_requests (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        token_hash text not null unique,
        google_review_url text null,
        sent_at timestamptz not null default now(),
        expires_at timestamptz not null,
        responded_at timestamptz null,
        clicked_google_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
    execute $sql$
      create table if not exists public.testimonials (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        request_id uuid null references public.review_requests(id) on delete set null,
        rating int null check (rating between 1 and 5),
        body text not null default '',
        author_name text null,
        author_title text null,
        is_published boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.review_requests is
  'Outbound asks for client testimonials / Google reviews after a transaction closes. Tokenized public landing page; one request per (agent, contact) is enforced at the service layer.';

comment on table public.testimonials is
  'Stored testimonials the agent can later surface as marketing copy. is_published gates display on the agent''s profile / IDX site.';

-- ── triggers ────────────────────────────────────────────────────

create or replace function public.set_review_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists review_requests_set_updated_at on public.review_requests;
create trigger review_requests_set_updated_at
  before update on public.review_requests
  for each row execute procedure public.set_review_requests_updated_at();

create or replace function public.set_testimonials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists testimonials_set_updated_at on public.testimonials;
create trigger testimonials_set_updated_at
  before update on public.testimonials
  for each row execute procedure public.set_testimonials_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_review_requests_agent_sent
  on public.review_requests (agent_id, sent_at desc);

create index if not exists idx_review_requests_pending
  on public.review_requests (expires_at)
  where responded_at is null;

create index if not exists idx_testimonials_agent_published
  on public.testimonials (agent_id, is_published, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.review_requests enable row level security;
alter table public.testimonials enable row level security;

drop policy if exists "review_requests_select_own" on public.review_requests;
create policy "review_requests_select_own"
  on public.review_requests
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = review_requests.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

-- Insert / update / delete on review_requests + testimonials goes
-- through the service-role server path (cron / accept handler / agent
-- actions), so no client-side write policies needed for MVP.

drop policy if exists "testimonials_select_own" on public.testimonials;
create policy "testimonials_select_own"
  on public.testimonials
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = testimonials.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "testimonials_select_published" on public.testimonials;
create policy "testimonials_select_published"
  on public.testimonials
  for select
  using (is_published = true);


-- FILE: 20260521000000_listing_presentations.sql

-- Listing presentations.
--
-- The seller-facing pitch deck an agent assembles when they're
-- competing for a listing. Real-estate-specific composite of
-- artifacts the CRM already produces:
--   - cover (property address + agent branding)
--   - cma (comparable sales — from lib/cma/)
--   - pricing_strategy (target list + recommended range)
--   - marketing_plan (from lib/marketing/)
--   - agent_bio + testimonials (from #203)
--   - net_to_seller (from lib/listing-offers/)
--   - next_steps
--
-- This table holds the state of one presentation per (agent,
-- property). The `sections` JSONB array drives which slides
-- render and in what order — agents can drag-reorder or hide
-- sections without a schema change.
--
-- Sharing model: a `shareable_token` (hashed) is the URL the
-- agent texts to the seller. Token-only auth keeps the seller
-- out of the agent's CRM session.
--
-- agent_id type adapts to public.agents.id (uuid OR bigint).

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.listing_presentations (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        property_address text not null,
        property_city text null,
        property_state text null,
        property_zip text null,
        suggested_list_price numeric(14, 2) null,
        suggested_list_low numeric(14, 2) null,
        suggested_list_high numeric(14, 2) null,
        sections jsonb not null default '[]'::jsonb,
        status text not null default 'draft' check (status in (
          'draft','ready','shared','closed','archived'
        )),
        -- Hashed shareable token. Raw token only ever leaves the
        -- server in the link the agent shares.
        share_token_hash text null unique,
        shared_with_email text null,
        shared_at timestamptz null,
        viewed_at timestamptz null,
        view_count int not null default 0,
        rendered_pdf_url text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.listing_presentations (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        property_address text not null,
        property_city text null,
        property_state text null,
        property_zip text null,
        suggested_list_price numeric(14, 2) null,
        suggested_list_low numeric(14, 2) null,
        suggested_list_high numeric(14, 2) null,
        sections jsonb not null default '[]'::jsonb,
        status text not null default 'draft' check (status in (
          'draft','ready','shared','closed','archived'
        )),
        share_token_hash text null unique,
        shared_with_email text null,
        shared_at timestamptz null,
        viewed_at timestamptz null,
        view_count int not null default 0,
        rendered_pdf_url text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.listing_presentations is
  'Seller-facing pitch decks composed from CMA + marketing plan + testimonials + net-to-seller. sections JSONB drives slide order; share_token_hash gates the public seller view.';

comment on column public.listing_presentations.sections is
  'Ordered array of section descriptors: [{type:"cma",enabled:true,config:{...}}, ...]. Type values match the SECTION_KINDS enum in lib/listing-presentations/sections.ts.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_listing_presentations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listing_presentations_set_updated_at on public.listing_presentations;
create trigger listing_presentations_set_updated_at
  before update on public.listing_presentations
  for each row execute procedure public.set_listing_presentations_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_listing_presentations_agent_status
  on public.listing_presentations (agent_id, status, created_at desc);

create index if not exists idx_listing_presentations_contact
  on public.listing_presentations (contact_id)
  where contact_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.listing_presentations enable row level security;

drop policy if exists "listing_presentations_select_own" on public.listing_presentations;
create policy "listing_presentations_select_own"
  on public.listing_presentations
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "listing_presentations_insert_own" on public.listing_presentations;
create policy "listing_presentations_insert_own"
  on public.listing_presentations
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "listing_presentations_update_own" on public.listing_presentations;
create policy "listing_presentations_update_own"
  on public.listing_presentations
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "listing_presentations_delete_own" on public.listing_presentations;
create policy "listing_presentations_delete_own"
  on public.listing_presentations
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260523000000_buyer_broker_agreements.sql

-- Buyer Broker Agreements (BBA / Buyer Agency Agreement).
--
-- Required by the August 2024 NAR settlement: a US buyer must
-- sign a written agreement with their buyer's agent BEFORE the
-- agent can show them homes (varies by state, but most enforce
-- it). This table tracks the agreement's lifecycle so other
-- surfaces (showing scheduling, transaction creation) can gate
-- on "is there an active BBA on file?"
--
-- Plumbs through the e-sign infra from #199 / #201 — a BBA's
-- `signature_envelope_id` points to the envelope that sent it
-- to the buyer for signature. When the envelope hits 'completed',
-- a follow-up cron (or signature_events trigger downstream) flips
-- this row's status to 'signed' and stamps signed_at from the
-- envelope's completed_at.
--
-- agent_id type adapts to public.agents.id (uuid OR bigint).

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.buyer_broker_agreements (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null,
        -- Two-letter US state code. Drives template selection +
        -- per-state expiry / exclusivity defaults.
        state_code text null,
        status text not null default 'draft' check (status in (
          'draft','sent','signed','declined','expired','terminated'
        )),
        is_exclusive boolean not null default true,
        -- Agreed buyer-side commission, e.g. 2.5%. Null when the
        -- agreement is fee-based or hasn't been filled in yet.
        buyer_commission_pct numeric(5, 2) null,
        flat_fee_amount numeric(12, 2) null,
        effective_start_date date null,
        effective_end_date date null,
        signed_at timestamptz null,
        terminated_at timestamptz null,
        terminated_reason text null,
        -- Optional: link to the e-sign envelope that delivered it.
        signature_envelope_id uuid null references public.signature_envelopes(id) on delete set null,
        pdf_url text null,
        notes text null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.buyer_broker_agreements (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null,
        state_code text null,
        status text not null default 'draft' check (status in (
          'draft','sent','signed','declined','expired','terminated'
        )),
        is_exclusive boolean not null default true,
        buyer_commission_pct numeric(5, 2) null,
        flat_fee_amount numeric(12, 2) null,
        effective_start_date date null,
        effective_end_date date null,
        signed_at timestamptz null,
        terminated_at timestamptz null,
        terminated_reason text null,
        signature_envelope_id uuid null references public.signature_envelopes(id) on delete set null,
        pdf_url text null,
        notes text null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.buyer_broker_agreements is
  'Buyer Broker Agreements (NAR-settlement-compliant). One row per (agent, contact) lifecycle; gate showings + transaction creation on status=signed AND not expired.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_buyer_broker_agreements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists buyer_broker_agreements_set_updated_at on public.buyer_broker_agreements;
create trigger buyer_broker_agreements_set_updated_at
  before update on public.buyer_broker_agreements
  for each row execute procedure public.set_buyer_broker_agreements_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

-- "Does this contact have an active BBA?" — hot-path gate query
-- on showing scheduling.
create index if not exists idx_bba_contact_status
  on public.buyer_broker_agreements (contact_id, status, effective_end_date desc);

-- Agent dashboard listing.
create index if not exists idx_bba_agent_status
  on public.buyer_broker_agreements (agent_id, status, created_at desc);

-- Renewal sweep: "find BBAs expiring in N days".
create index if not exists idx_bba_expiring_signed
  on public.buyer_broker_agreements (effective_end_date)
  where status = 'signed';

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.buyer_broker_agreements enable row level security;

drop policy if exists "bba_select_own" on public.buyer_broker_agreements;
create policy "bba_select_own"
  on public.buyer_broker_agreements
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "bba_insert_own" on public.buyer_broker_agreements;
create policy "bba_insert_own"
  on public.buyer_broker_agreements
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "bba_update_own" on public.buyer_broker_agreements;
create policy "bba_update_own"
  on public.buyer_broker_agreements
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "bba_delete_own" on public.buyer_broker_agreements;
create policy "bba_delete_own"
  on public.buyer_broker_agreements
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260524000000_team_isa_role.sql

-- Allow team members to have role='isa' (Inside Sales Agent).
--
-- The team-accounts schema (#189) shipped with role enum
-- {'owner','member'}. ISA workflows need a third role so the
-- lead-routing layer can:
--   1. Send every new lead to an ISA first (round-robin within
--      role='isa')
--   2. Once the ISA qualifies it, hand off to a 'member'
--      (closing agent)
--
-- Closer = non-ISA team member. We don't introduce a 'closer'
-- role explicitly — 'member' covers it. Owners can also act
-- as closers.
--
-- This migration relaxes the CHECK constraint to include 'isa'.
-- Existing 'owner'/'member' rows remain valid.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'team_memberships'
  ) then
    -- Drop the old check constraint by name. The original migration
    -- generated an unnamed constraint, so postgres named it
    -- `team_memberships_role_check`.
    execute 'alter table public.team_memberships drop constraint if exists team_memberships_role_check';
    execute $sql$
      alter table public.team_memberships
      add constraint team_memberships_role_check
        check (role in ('owner','member','isa'))
    $sql$;
  end if;
end $$;

comment on column public.team_memberships.role is
  'Role within the team: owner (full control) | member (default closer) | isa (Inside Sales Agent — first-touch lead qualification, hands off to a member after qualifying).';


-- FILE: 20260525000000_contact_custom_fields.sql

-- Custom fields on contacts.
--
-- Closes the "custom fields on contacts" gap from the analysis.
-- Each agent (or team owner, on behalf of the team's roster)
-- defines fields like "Budget", "Pre-approval lender", "Best
-- school district preference" and the values get stored on
-- contacts.custom_fields (jsonb).
--
-- Why JSONB rather than a normalized field-values table:
--   - Single read returns the full contact + all custom values
--     (no extra join hop)
--   - GIN index can be added later if filter-by-custom-field
--     becomes a hot query
--   - Type validation lives at the app layer (per-field-type
--     coercion in lib/contact-fields/values.ts)
--
-- agent_id type adapts to public.agents.id (uuid OR bigint).

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.agent_contact_field_defs (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        -- Stable identifier used in contacts.custom_fields[].
        -- Snake_case, no spaces. Unique per-agent.
        field_key text not null,
        label text not null,
        field_type text not null check (field_type in (
          'text','longtext','number','boolean','date','select','multiselect'
        )),
        -- For select / multiselect: array of {value, label} pairs.
        -- Ignored on other types.
        options jsonb not null default '[]'::jsonb,
        is_required boolean not null default false,
        sort_order int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, field_key)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_contact_field_defs (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        field_key text not null,
        label text not null,
        field_type text not null check (field_type in (
          'text','longtext','number','boolean','date','select','multiselect'
        )),
        options jsonb not null default '[]'::jsonb,
        is_required boolean not null default false,
        sort_order int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, field_key)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

-- Add custom_fields jsonb to contacts. Nullable + default empty
-- object so existing rows are unaffected.
alter table if exists public.contacts
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

comment on table public.agent_contact_field_defs is
  'Per-agent custom field definitions for the contacts surface. Values land in contacts.custom_fields keyed by field_key.';
comment on column public.agent_contact_field_defs.field_key is
  'Snake_case stable id, unique per agent. Used as the JSON key in contacts.custom_fields.';
comment on column public.agent_contact_field_defs.options is
  'For select/multiselect types: [{value, label}, ...]. Empty array on other types.';
comment on column public.contacts.custom_fields is
  'Bag of agent-defined field values. Keys must match agent_contact_field_defs.field_key for the contact''s agent. App layer validates types.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_agent_contact_field_defs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_contact_field_defs_set_updated_at on public.agent_contact_field_defs;
create trigger agent_contact_field_defs_set_updated_at
  before update on public.agent_contact_field_defs
  for each row execute procedure public.set_agent_contact_field_defs_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_field_defs_agent_sort
  on public.agent_contact_field_defs (agent_id, sort_order);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.agent_contact_field_defs enable row level security;

drop policy if exists "field_defs_select_own" on public.agent_contact_field_defs;
create policy "field_defs_select_own"
  on public.agent_contact_field_defs
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "field_defs_insert_own" on public.agent_contact_field_defs;
create policy "field_defs_insert_own"
  on public.agent_contact_field_defs
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "field_defs_update_own" on public.agent_contact_field_defs;
create policy "field_defs_update_own"
  on public.agent_contact_field_defs
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "field_defs_delete_own" on public.agent_contact_field_defs;
create policy "field_defs_delete_own"
  on public.agent_contact_field_defs
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260526000000_video_messages.sql

-- Video email messages.
--
-- Closes the "video email / video messaging" gap from the
-- analysis. The agent records a short video (browser
-- MediaRecorder), uploads to storage, and emails a thumbnail
-- linking to a public player page. View analytics flow back so
-- the agent can see "Bob watched 70% of your follow-up video".
--
-- This migration is the data foundation. Browser recording UI
-- and the storage upload pipeline ship in follow-up PRs.
--
-- Two tables:
--   - video_messages: one row per recorded video. Token-gated
--     public view URL at /v/[token]
--   - video_message_views: append-only view log (one row per
--     play). Ip hashed for privacy; watch_pct (0-100) lets the
--     dashboard show "watched 70%" instead of just a play count
--
-- agent_id type adapts to public.agents.id (uuid OR bigint).

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.video_messages (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        title text not null default '',
        video_url text not null,
        thumbnail_url text null,
        duration_seconds int not null default 0 check (duration_seconds >= 0),
        -- Hashed share token. Raw token only ever leaves the
        -- server in the embedded thumbnail link.
        share_token_hash text not null unique,
        is_published boolean not null default true,
        view_count int not null default 0,
        unique_view_count int not null default 0,
        last_viewed_at timestamptz null,
        sent_to_email text null,
        sent_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.video_message_views (
        id uuid primary key default gen_random_uuid(),
        video_id uuid not null references public.video_messages(id) on delete cascade,
        -- SHA-256 hex of the viewer's IP. Lets us count unique
        -- viewers without storing raw IPs.
        ip_hash text null,
        user_agent text null,
        -- 0-100. Updates on the same view as the player
        -- progresses; final value is what we keep.
        watch_pct int not null default 0 check (watch_pct between 0 and 100),
        watched_seconds int not null default 0,
        occurred_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.video_messages (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        title text not null default '',
        video_url text not null,
        thumbnail_url text null,
        duration_seconds int not null default 0 check (duration_seconds >= 0),
        share_token_hash text not null unique,
        is_published boolean not null default true,
        view_count int not null default 0,
        unique_view_count int not null default 0,
        last_viewed_at timestamptz null,
        sent_to_email text null,
        sent_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.video_message_views (
        id uuid primary key default gen_random_uuid(),
        video_id uuid not null references public.video_messages(id) on delete cascade,
        ip_hash text null,
        user_agent text null,
        watch_pct int not null default 0 check (watch_pct between 0 and 100),
        watched_seconds int not null default 0,
        occurred_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.video_messages is
  'Agent-recorded video messages. Token-gated public viewer at /v/[token]; views persist to video_message_views for engagement analytics.';

comment on column public.video_messages.duration_seconds is
  'Total length of the video. Used to compute watch_pct from watched_seconds.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_video_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists video_messages_set_updated_at on public.video_messages;
create trigger video_messages_set_updated_at
  before update on public.video_messages
  for each row execute procedure public.set_video_messages_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_video_messages_agent_created
  on public.video_messages (agent_id, created_at desc);

create index if not exists idx_video_messages_contact
  on public.video_messages (contact_id)
  where contact_id is not null;

create index if not exists idx_video_message_views_video
  on public.video_message_views (video_id, occurred_at desc);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.video_messages enable row level security;
alter table public.video_message_views enable row level security;

drop policy if exists "video_messages_select_own" on public.video_messages;
create policy "video_messages_select_own"
  on public.video_messages
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "video_messages_insert_own" on public.video_messages;
create policy "video_messages_insert_own"
  on public.video_messages
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "video_messages_update_own" on public.video_messages;
create policy "video_messages_update_own"
  on public.video_messages
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "video_messages_delete_own" on public.video_messages;
create policy "video_messages_delete_own"
  on public.video_messages
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

-- Views: agents can read views for their own videos.
drop policy if exists "video_message_views_select_own" on public.video_message_views;
create policy "video_message_views_select_own"
  on public.video_message_views
  for select
  using (
    exists (
      select 1 from public.video_messages v
      join public.agents a on a.id = v.agent_id
      where v.id = video_message_views.video_id
        and a.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260527000000_coaching_enrollments.sql

-- LeadSmart AI Coaching enrollments.
--
-- The coaching layer (the gap-analysis differentiator) packages
-- two programs:
--   - 'producer_track'      — auto-enrolled on Pro+ (free)
--   - 'top_producer_track'  — bundled on Premium and Team
--
-- Program metadata lives in code (lib/coaching-programs/programs.ts)
-- so editing copy + targets doesn't require a migration. Enrollment
-- state is the only thing the DB has to track:
--   - One row per (agent, program)
--   - opted_out_at lets the agent leave the program without losing
--     historic enrollment context
--   - Re-enrollment (re-set opted_out_at to null) is allowed
--
-- agent_id type adapts to public.agents.id (uuid OR bigint), same
-- pattern as the recent migrations.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.coaching_enrollments (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        program_slug text not null check (program_slug in (
          'producer_track','top_producer_track'
        )),
        enrolled_at timestamptz not null default now(),
        opted_out_at timestamptz null,
        opt_out_reason text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, program_slug)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.coaching_enrollments (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        program_slug text not null check (program_slug in (
          'producer_track','top_producer_track'
        )),
        enrolled_at timestamptz not null default now(),
        opted_out_at timestamptz null,
        opt_out_reason text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, program_slug)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.coaching_enrollments is
  'Per-agent enrollment state for LeadSmart AI Coaching programs (Producer Track, Top Producer Track). Program metadata + targets live in lib/coaching-programs/programs.ts.';

comment on column public.coaching_enrollments.opted_out_at is
  'Set when the agent opts out. Re-enrollment is allowed by clearing this back to NULL — preserves historical context vs deleting the row.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_coaching_enrollments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coaching_enrollments_set_updated_at on public.coaching_enrollments;
create trigger coaching_enrollments_set_updated_at
  before update on public.coaching_enrollments
  for each row execute procedure public.set_coaching_enrollments_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

-- "Show me my active enrollments" — dashboard hot path. Partial
-- index on the active subset keeps it small.
create index if not exists idx_coaching_enrollments_agent_active
  on public.coaching_enrollments (agent_id)
  where opted_out_at is null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.coaching_enrollments enable row level security;

drop policy if exists "coaching_enrollments_select_own" on public.coaching_enrollments;
create policy "coaching_enrollments_select_own"
  on public.coaching_enrollments
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_enrollments_insert_own" on public.coaching_enrollments;
create policy "coaching_enrollments_insert_own"
  on public.coaching_enrollments
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = coaching_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_enrollments_update_own" on public.coaching_enrollments;
create policy "coaching_enrollments_update_own"
  on public.coaching_enrollments
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = coaching_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );


-- FILE: 20260530000000_column_drift_catchup.sql

-- Column-level drift catch-up — adds the columns whose original
-- migrations targeted public.leads (now a view) or were never run
-- against the live DB. Limited to columns the active code base
-- actually queries (verified via grep on apps/leadsmartai/{app,lib}).
--
-- Skipped intentionally:
--   • user_profiles billing columns (stripe_customer_id, subscription_*,
--     tokens_*, trial_*, plan, role, brokerage, license_number, …) —
--     those features migrated to public.leadsmart_users; the
--     user_profiles ALTER migrations are stale.
--   • _agent_pk_migrate transient columns from in-flight schema swaps.
--   • Tier-2 contacts columns whose names collide with already-live
--     equivalents (zip vs zip_code, score vs confidence_score,
--     location vs full_address, etc.).
--
-- Idempotent — every ADD COLUMN uses IF NOT EXISTS so the migration
-- can be re-run without effect once applied.

-- ── contacts: greeting + enrichment + dedup column gaps ─────────────
alter table public.contacts
  add column if not exists birthday date,
  add column if not exists home_purchase_date date,
  add column if not exists preferred_contact_channel text,
  add column if not exists preferred_contact_time text,
  add column if not exists contact_opt_out_email boolean not null default false,
  add column if not exists contact_opt_out_sms boolean not null default false,
  add column if not exists relationship_stage text,
  add column if not exists lead_tags_json jsonb not null default '[]'::jsonb,
  add column if not exists contact_completeness_score integer not null default 0,
  add column if not exists enrichment_status text,
  add column if not exists inferred_contact_type text,
  add column if not exists inferred_lifecycle_stage text,
  add column if not exists duplicate_group_key text,
  add column if not exists notes_summary text,
  add column if not exists normalized_email text,
  add column if not exists normalized_phone text,
  add column if not exists normalized_address text,
  add column if not exists mailing_address text,
  add column if not exists sms_opted_out_at timestamptz;

-- merged_into_lead_id is a self-FK; original migration used bigint
-- because contacts was previously called `leads`. Repointed to
-- contacts(id) (uuid). Code in lib/contact-enrichment/* reads + sets
-- this field with 13 callers — naming kept as merged_into_lead_id
-- (not _contact_id) to avoid a separate code rename.
alter table public.contacts
  add column if not exists merged_into_lead_id uuid
    references public.contacts(id) on delete set null;

create index if not exists idx_contacts_normalized_email
  on public.contacts(normalized_email)
  where normalized_email is not null;
create index if not exists idx_contacts_normalized_phone
  on public.contacts(normalized_phone)
  where normalized_phone is not null;
create index if not exists idx_contacts_duplicate_group_key
  on public.contacts(duplicate_group_key)
  where duplicate_group_key is not null;
create index if not exists idx_contacts_merged_into
  on public.contacts(merged_into_lead_id)
  where merged_into_lead_id is not null;

comment on column public.contacts.preferred_contact_channel is
  'sms | email | both — used by smart greeting routing';
comment on column public.contacts.lead_tags_json is
  'Arbitrary string tags for segmentation (JSON array of strings).';
comment on column public.contacts.merged_into_lead_id is
  'When set, this contact is archived as a duplicate of the referenced contact.';
comment on column public.contacts.duplicate_group_key is
  'Optional stable key for grouping related duplicates (e.g. hash of email+phone).';

-- ── lead_calls: call-lifecycle metadata ─────────────────────────────
alter table public.lead_calls
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists needs_human boolean not null default false,
  add column if not exists inferred_intent text;

create index if not exists idx_lead_calls_started_at
  on public.lead_calls(started_at desc)
  where started_at is not null;

-- ── subscription_events: arbitrary event metadata ───────────────────
alter table public.subscription_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;


-- FILE: 20260531000000_crm_tasks_nurture_alerts_compat.sql

-- Compat columns missed by the contacts consolidation rebuild.
--
-- crm_tasks: the 20260480100000 consolidation recreated crm_tasks without
--   `task_type` and `created_by` which the mobile Calendar API selects and inserts.
--
-- nurture_alerts: was created with `lead_id bigint` (old leads PK) before the
--   leads → contacts migration. Mobile Inbox queries `contact_id` (uuid). Add the
--   column nullable so queries don't crash; rows are populated going forward.

alter table public.crm_tasks
  add column if not exists task_type  text,
  add column if not exists created_by text;

alter table public.nurture_alerts
  add column if not exists contact_id uuid
    references public.contacts(id) on delete cascade;

create index if not exists idx_nurture_alerts_contact_id_created_at
  on public.nurture_alerts(contact_id, created_at desc)
  where contact_id is not null;
