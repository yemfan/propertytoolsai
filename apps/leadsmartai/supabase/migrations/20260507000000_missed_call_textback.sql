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

-- ── 1. agents.forwarding_phone ───────────────────────────────────

alter table public.agents
  add column if not exists forwarding_phone text;

comment on column public.agents.forwarding_phone is
  'Agent''s personal mobile number for inbound call forwarding and outbound click-to-call. Stored as raw input; normalized at use time.';

-- ── 2. missed_call_settings ──────────────────────────────────────

create table if not exists public.missed_call_settings (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  enabled boolean not null default false,
  ring_timeout_seconds int not null default 20
    check (ring_timeout_seconds between 5 and 60),
  -- Custom SMS template. Tokens substituted at send-time:
  --   {{caller_name}} → contact name if known, else "there"
  --   {{agent_first_name}} → from agents.full_name
  --   {{agent_brand}} → brand name when set, else first name
  message_template text not null default
    'Hey {{caller_name}} — {{agent_first_name}} here. Sorry I missed your call. What''s the best way I can help? Happy to text or set up a quick call back.',
  -- When true and the caller is a known contact, draft via OpenAI
  -- using the agent's selected sales-model tone instead of the
  -- template above. Falls back to the template on AI error/quota.
  use_ai_personalization boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.missed_call_settings is
  'Per-agent missed-call text-back configuration. One row per agent.';

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

-- ── 3. call_logs ─────────────────────────────────────────────────

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  -- Twilio call identifiers. parent_sid is set on outbound legs
  -- created via REST so we can reconcile the bridged call (agent
  -- leg + lead leg) into a single conversation.
  twilio_call_sid text,
  parent_call_sid text,
  direction text not null
    check (direction in ('inbound', 'outbound')),
  -- Status mirrors Twilio's vocabulary so we can record raw values.
  -- Common values:
  --   queued / ringing / in-progress / completed / busy / failed
  --   no-answer / canceled / missed (custom: missed_call_textback fired)
  status text not null,
  from_phone text,
  to_phone text,
  duration_seconds int,
  recording_url text,
  -- When status = 'missed' AND a missed-call SMS was sent, this is
  -- the message_logs.id of the auto-text. Lets the settings UI show
  -- "missed call → text sent" as a single timeline row.
  textback_message_log_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_call_logs_agent_created
  on public.call_logs(agent_id, created_at desc);
create index if not exists idx_call_logs_contact_created
  on public.call_logs(contact_id, created_at desc);
create index if not exists idx_call_logs_twilio_sid
  on public.call_logs(twilio_call_sid);

comment on table public.call_logs is
  'Inbound + outbound call history. One row per call leg from Twilio. Powers the missed-call activity log + power-dialer history.';

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
