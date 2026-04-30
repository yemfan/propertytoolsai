-- Cache for AI-generated "Growth & Opportunities" suggestions on
-- /dashboard/growth.
--
-- Claude calls for opportunity generation are ~$0.05-0.15 per run and
-- take 10-20s. Without a cache, every page load hits the model —
-- agents refresh this tab a few times a day and we'd burn budget for
-- marginal value. A 1-hour TTL matches how fast the underlying data
-- moves (contacts + deals change hourly, not every minute).
--
-- `payload jsonb` stores the full list of opportunity cards as
-- generated. If the schema evolves, we invalidate all rows — cheap
-- to regenerate on next page load.

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.growth_opportunities_cache (
        agent_id uuid primary key references public.agents(id) on delete cascade,
        payload jsonb not null,
        generated_at timestamptz not null default now(),
        expires_at timestamptz not null
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.growth_opportunities_cache (
        agent_id bigint primary key references public.agents(id) on delete cascade,
        payload jsonb not null,
        generated_at timestamptz not null default now(),
        expires_at timestamptz not null
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_growth_opportunities_cache_expires
  on public.growth_opportunities_cache (expires_at);

comment on table public.growth_opportunities_cache is
  'Per-agent cache of Claude-generated growth opportunities. 1h TTL; force-refresh from the UI regenerate button.';
