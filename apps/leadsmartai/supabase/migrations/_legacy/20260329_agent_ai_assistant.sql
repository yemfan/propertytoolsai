-- Agent-side AI assistant: conversation memory + scheduled follow-ups
-- agent_id type matches public.agents.id (uuid OR bigint — see 20260319_tasks_schema_compat.sql)

alter table if exists public.agents
  add column if not exists ai_assistant_enabled boolean not null default true,
  add column if not exists ai_assistant_mode text not null default 'manual'
    check (ai_assistant_mode in ('auto', 'manual'));

comment on column public.agents.ai_assistant_enabled is 'Master switch for AI-generated replies & follow-ups.';
comment on column public.agents.ai_assistant_mode is 'auto: send AI replies without agent approval when safe; manual: suggest only.';

do $$
declare
  v_agent_type text;
  v_agent_id_typ oid;
  v_lc_typ oid;
  v_job_typ oid;
begin
  select a.atttypid, a.atttypid::regtype::text
    into v_agent_id_typ, v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_id_typ is null then
    raise exception 'public.agents.id not found';
  end if;

  -- If either table exists from a failed migration with the wrong agent_id type, drop both.
  select a.atttypid into v_lc_typ
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'lead_conversations'
    and a.attname = 'agent_id'
    and a.attnum > 0
    and not a.attisdropped;

  select a.atttypid into v_job_typ
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'ai_followup_jobs'
    and a.attname = 'agent_id'
    and a.attnum > 0
    and not a.attisdropped;

  if (v_lc_typ is not null and v_lc_typ <> v_agent_id_typ)
     or (v_job_typ is not null and v_job_typ <> v_agent_id_typ) then
    drop table if exists public.ai_followup_jobs cascade;
    drop table if exists public.lead_conversations cascade;
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.lead_conversations (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id uuid references public.agents(id) on delete set null,
        messages jsonb not null default '[]'::jsonb,
        preferences jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        unique (lead_id)
      )
    $sql$;
    execute $sql$
      create table if not exists public.ai_followup_jobs (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id uuid references public.agents(id) on delete set null,
        kind text not null check (kind in ('1h', '24h', '3d')),
        run_at timestamptz not null,
        status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'skipped', 'cancelled', 'failed')),
        last_error text,
        created_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.lead_conversations (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id bigint references public.agents(id) on delete set null,
        messages jsonb not null default '[]'::jsonb,
        preferences jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        unique (lead_id)
      )
    $sql$;
    execute $sql$
      create table if not exists public.ai_followup_jobs (
        id uuid primary key default gen_random_uuid(),
        lead_id bigint not null references public.leads(id) on delete cascade,
        agent_id bigint references public.agents(id) on delete set null,
        kind text not null check (kind in ('1h', '24h', '3d')),
        run_at timestamptz not null,
        status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'skipped', 'cancelled', 'failed')),
        last_error text,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_lead_conversations_lead_id on public.lead_conversations(lead_id);
create index if not exists idx_lead_conversations_agent_id on public.lead_conversations(agent_id);

comment on table public.lead_conversations is 'AI assistant thread: messages[{role,content,created_at,source?}], preferences{tone?, channel?}';

create index if not exists idx_ai_followup_jobs_run_status
  on public.ai_followup_jobs(run_at, status)
  where status = 'scheduled';

create index if not exists idx_ai_followup_jobs_lead on public.ai_followup_jobs(lead_id);
