-- Unify CRM satellite tables: lead_id as TEXT, drop mismatched FKs to public.leads.
-- Supersedes uuid+bigint FK errors (42804). Idempotent.
-- Full copy also lives at scripts/sql/leads-crm-complete.sql (with BEGIN/COMMIT for manual runs).

do $$
declare
  r record;
begin
  for r in
    select c.conname, n.nspname, t.relname as table_name
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and n.nspname = 'public'
      and a.attname = 'lead_id'
      and pg_get_constraintdef(c.oid) ilike '%leads%'
  loop
    execute format('alter table if exists %I.%I drop constraint if exists %I',
      r.nspname, r.table_name, r.conname);
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'lead_id'
      and data_type not in ('text', 'character varying')
      and table_name in (
        'lead_conversations',
        'lead_activity_events',
        'lead_followups',
        'lead_conversions',
        'lead_saved_searches',
        'home_value_reports',
        'agent_notifications',
        'lead_events',
        'message_logs',
        'communications',
        'lead_sequences',
        'nurture_alerts'
      )
  loop
    execute format(
      'alter table public.%I alter column lead_id type text using lead_id::text',
      r.table_name
    );
  end loop;
end $$;

-- CREATE TABLE IF NOT EXISTS does not add columns to pre-existing tables; indexes on
-- created_at then fail with 42703. Ensure/backfill created_at after all creates (3a–3b).

create table if not exists public.lead_conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  channel text not null default 'email',
  subject text null,
  message text not null,
  sender_name text null,
  sender_email text null,
  recipient_name text null,
  recipient_email text null,
  status text not null default 'sent',
  related_followup_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_activity_events (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  event_type text not null,
  title text not null,
  description text null,
  source text null,
  actor_type text null,
  actor_name text null,
  actor_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  assigned_agent_id text null,
  channel text not null,
  subject text null,
  message text not null,
  status text not null default 'pending',
  step_number int not null default 1,
  scheduled_for timestamptz not null,
  sequence_key text null,
  template_key text null,
  variant_key text null,
  recipient_name text null,
  recipient_email text null,
  recipient_phone text null,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_followups_lead_id on public.lead_followups (lead_id);
create index if not exists idx_lead_followups_assigned_scheduled
  on public.lead_followups (assigned_agent_id, scheduled_for asc);
create index if not exists idx_lead_followups_pending_scheduled
  on public.lead_followups (scheduled_for asc)
  where status = 'pending';

create table if not exists public.lead_saved_searches (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  preferences jsonb not null,
  frequency text not null default 'daily',
  last_sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_saved_searches_lead_id on public.lead_saved_searches (lead_id);
create index if not exists idx_lead_saved_searches_frequency on public.lead_saved_searches (frequency);

create table if not exists public.lead_conversions (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  agent_id text null,
  gross_commission numeric(14, 2) not null default 0,
  recurring_revenue numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_conversions_lead_id on public.lead_conversions (lead_id);
create index if not exists idx_lead_conversions_agent_id on public.lead_conversions (agent_id);

create table if not exists public.home_value_reports (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  lead_id text null,
  property_address text not null,
  estimate_value numeric not null,
  range_low numeric not null,
  range_high numeric not null,
  confidence text not null,
  report_json jsonb not null,
  pdf_url text null,
  emailed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_home_value_reports_lead_id on public.home_value_reports (lead_id);

create table if not exists public.agent_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  lead_id text null,
  type text not null,
  title text not null,
  message text not null,
  status text not null default 'unread',
  action_url text null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists idx_agent_notifications_lead_id on public.agent_notifications (lead_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'lead_conversations',
    'lead_activity_events',
    'lead_followups',
    'lead_saved_searches',
    'lead_conversions',
    'home_value_reports',
    'agent_notifications'
  ]
  loop
    execute format(
      'alter table if exists public.%I add column if not exists created_at timestamptz',
      t
    );
  end loop;
end $$;

do $$
declare
  t text;
  still_null boolean;
begin
  foreach t in array array[
    'lead_conversations',
    'lead_activity_events',
    'lead_followups',
    'lead_saved_searches',
    'lead_conversions',
    'home_value_reports',
    'agent_notifications'
  ]
  loop
    if not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = t
    ) then
      continue;
    end if;
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'created_at'
    ) then
      continue;
    end if;

    execute format(
      'update public.%I set created_at = coalesce(created_at, now()) where created_at is null',
      t
    );
    execute format(
      'alter table public.%I alter column created_at set default now()',
      t
    );

    execute format(
      'select exists (select 1 from public.%I where created_at is null limit 1)',
      t
    ) into still_null;

    if not still_null then
      begin
        execute format(
          'alter table public.%I alter column created_at set not null',
          t
        );
      exception
        when others then
          null;
      end;
    end if;
  end loop;
end $$;

create index if not exists idx_lead_conversations_lead_id_created
  on public.lead_conversations (lead_id, created_at desc);

create index if not exists idx_lead_activity_events_lead_id_created_at
  on public.lead_activity_events (lead_id, created_at desc);

create index if not exists idx_lead_conversions_created_at on public.lead_conversions (created_at desc);

alter table if exists public.leads
  add column if not exists lead_score integer not null default 0;

alter table if exists public.leads
  add column if not exists lead_temperature text not null default 'cold';

alter table if exists public.leads
  add column if not exists last_activity_at timestamptz;

create index if not exists idx_leads_lead_score_desc on public.leads (lead_score desc nulls last);

alter table if exists public.lead_activity_events
  add column if not exists actor_id text null;

alter table if exists public.lead_followups
  add column if not exists variant_key text null;

alter table if exists public.lead_followups
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.lead_conversations
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on table public.lead_conversations is 'CRM email/SMS/chat thread rows per lead.';
comment on table public.lead_activity_events is 'CRM timeline events (Smart Match, listing, affordability, etc.).';
comment on table public.lead_followups is 'Scheduled outbound sequence steps.';
comment on table public.lead_saved_searches is 'Smart Match saved searches for digest cron.';
comment on table public.lead_conversions is 'Attributed revenue rows for admin performance.';
