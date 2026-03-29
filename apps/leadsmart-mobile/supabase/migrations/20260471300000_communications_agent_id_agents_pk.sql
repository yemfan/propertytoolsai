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
