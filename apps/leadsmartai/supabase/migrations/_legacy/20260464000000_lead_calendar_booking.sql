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
