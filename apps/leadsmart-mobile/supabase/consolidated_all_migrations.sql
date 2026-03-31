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
