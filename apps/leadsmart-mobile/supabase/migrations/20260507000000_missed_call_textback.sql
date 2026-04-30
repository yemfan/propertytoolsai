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
