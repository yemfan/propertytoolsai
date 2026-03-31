-- Per-agent AI tone/style (SMS, email, voice, greetings). agent_id follows public.agents.id (uuid or bigint).

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
      create table if not exists public.agent_ai_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        personality text not null default 'friendly'
          check (personality in ('friendly', 'professional', 'luxury')),
        default_language text not null default 'en'
          check (default_language in ('en', 'zh', 'auto')),
        bilingual_enabled boolean not null default false,
        style_notes text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_ai_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        personality text not null default 'friendly'
          check (personality in ('friendly', 'professional', 'luxury')),
        default_language text not null default 'en'
          check (default_language in ('en', 'zh', 'auto')),
        bilingual_enabled boolean not null default false,
        style_notes text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_ai_settings: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_agent_ai_settings_agent
  on public.agent_ai_settings(agent_id);

comment on table public.agent_ai_settings is 'Per-agent AI tone/style for SMS, email, call transcript summaries, and greeting copy (compliance logic unchanged).';
