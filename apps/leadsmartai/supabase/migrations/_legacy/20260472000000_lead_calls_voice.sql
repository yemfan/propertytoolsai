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
