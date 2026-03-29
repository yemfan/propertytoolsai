-- Per-lead tasks (distinct from crm_tasks pipeline rows).
-- `public.leads.id` is bigint in this project — not uuid.

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
      create table if not exists public.lead_tasks (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        assigned_agent_id uuid null references public.agents(id) on delete set null,
        title text not null,
        description text null,
        due_at timestamptz null,
        status text not null default 'open',
        priority text not null default 'medium',
        task_type text null,
        created_by text null default 'system',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.lead_tasks (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        assigned_agent_id bigint null references public.agents(id) on delete set null,
        title text not null,
        description text null,
        due_at timestamptz null,
        status text not null default 'open',
        priority text not null default 'medium',
        task_type text null,
        created_by text null default 'system',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for lead_tasks: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_lead_tasks_lead_id on public.lead_tasks(lead_id);
create index if not exists idx_lead_tasks_assigned_agent on public.lead_tasks(assigned_agent_id);
create index if not exists idx_lead_tasks_due_at on public.lead_tasks(due_at);
create index if not exists idx_lead_tasks_status on public.lead_tasks(status);

comment on table public.lead_tasks is 'Tasks attached to a lead; assigned_agent_id optional.';
