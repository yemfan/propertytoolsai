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
