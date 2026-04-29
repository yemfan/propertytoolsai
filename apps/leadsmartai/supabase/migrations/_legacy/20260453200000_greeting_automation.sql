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
