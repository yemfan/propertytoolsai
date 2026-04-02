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
