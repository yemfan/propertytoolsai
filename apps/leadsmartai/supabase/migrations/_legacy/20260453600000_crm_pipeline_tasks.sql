-- Deal pipeline stages + tasks (per agent). Optional lead.pipeline_stage_id for board views.

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
      create table if not exists public.crm_pipeline_stages (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        name text not null,
        slug text not null,
        position integer not null default 0,
        color text null,
        created_at timestamptz not null default now(),
        unique (agent_id, slug)
      )
    $sql$;
    execute $sql$
      create table if not exists public.crm_tasks (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        lead_id bigint null references public.leads(id) on delete set null,
        pipeline_stage_id uuid null references public.crm_pipeline_stages(id) on delete set null,
        title text not null,
        description text null,
        status text not null default 'open'
          check (status in ('open', 'done', 'cancelled')),
        priority text not null default 'normal'
          check (priority in ('low', 'normal', 'high', 'urgent')),
        due_at timestamptz null,
        completed_at timestamptz null,
        source text not null default 'agent'
          check (source in ('agent', 'ai', 'system', 'automation')),
        ai_rationale text null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.crm_pipeline_stages (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        name text not null,
        slug text not null,
        position integer not null default 0,
        color text null,
        created_at timestamptz not null default now(),
        unique (agent_id, slug)
      )
    $sql$;
    execute $sql$
      create table if not exists public.crm_tasks (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        lead_id bigint null references public.leads(id) on delete set null,
        pipeline_stage_id uuid null references public.crm_pipeline_stages(id) on delete set null,
        title text not null,
        description text null,
        status text not null default 'open'
          check (status in ('open', 'done', 'cancelled')),
        priority text not null default 'normal'
          check (priority in ('low', 'normal', 'high', 'urgent')),
        due_at timestamptz null,
        completed_at timestamptz null,
        source text not null default 'agent'
          check (source in ('agent', 'ai', 'system', 'automation')),
        ai_rationale text null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for crm_pipeline_stages: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_crm_pipeline_stages_agent_position
  on public.crm_pipeline_stages(agent_id, position);

create index if not exists idx_crm_tasks_agent_status_updated
  on public.crm_tasks(agent_id, status, updated_at desc);

create index if not exists idx_crm_tasks_lead_id
  on public.crm_tasks(lead_id)
  where lead_id is not null;

alter table if exists public.leads
  add column if not exists pipeline_stage_id uuid null references public.crm_pipeline_stages(id) on delete set null;

create index if not exists idx_leads_pipeline_stage_id
  on public.leads(pipeline_stage_id)
  where pipeline_stage_id is not null;

comment on table public.crm_pipeline_stages is 'Per-agent deal pipeline columns (buyer/seller workflow).';
comment on table public.crm_tasks is 'Tasks and follow-ups; may link to a lead and optional pipeline stage context.';
comment on column public.leads.pipeline_stage_id is 'Current deal stage for board/Kanban views.';
