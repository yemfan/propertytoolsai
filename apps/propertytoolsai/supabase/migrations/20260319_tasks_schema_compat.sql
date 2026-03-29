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

