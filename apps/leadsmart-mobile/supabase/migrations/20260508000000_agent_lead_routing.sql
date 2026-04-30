-- Per-agent IDX lead-routing rules.
--
-- Promotes the env-allowlist scaffold (IDX_ROUND_ROBIN_AGENT_IDS +
-- IDX_AGENT_ZIP_COVERAGE) to a DB-backed, agent-owned config so each
-- agent can self-serve their pool enrollment + ZIP coverage from the
-- settings UI.
--
-- One row per agent (PK on agent_id). Schema:
--   in_round_robin   bool  — opt into the round-robin pool
--   zip_coverage     text[] — 5-digit ZIPs this agent services. Empty
--                              array means "any ZIP" (the picker treats
--                              missing/empty coverage as no constraint).
--   priority         int   — reserved for future weighted round-robin.
--                              0 = standard pool. Higher = preferred slot
--                              (skip ahead in rotation). Default 0.
--
-- Resolution order in lib/leadAssignment/service.ts becomes:
--   1. DB rows where in_round_robin=true (this table)
--   2. env IDX_ROUND_ROBIN_AGENT_IDS (back-compat fallback)
--   3. env IDX_DEMO_AGENT_ID (single-agent demo fallback)
--   4. unassigned
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same pattern
-- as 20260507000000_missed_call_textback.sql.

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
      create table if not exists public.agent_lead_routing (
        agent_id uuid primary key references public.agents(id) on delete cascade,
        in_round_robin boolean not null default false,
        zip_coverage text[] not null default '{}',
        priority int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_lead_routing (
        agent_id bigint primary key references public.agents(id) on delete cascade,
        in_round_robin boolean not null default false,
        zip_coverage text[] not null default '{}',
        priority int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_lead_routing: %', v_agent_type;
  end if;
end $$;

comment on table public.agent_lead_routing is
  'Per-agent IDX lead-routing rules. One row per agent. Replaces env-allowlist scaffold (IDX_ROUND_ROBIN_AGENT_IDS / IDX_AGENT_ZIP_COVERAGE) with self-serve UI-backed config. Env still acts as a fallback when no rows have in_round_robin=true.';

comment on column public.agent_lead_routing.in_round_robin is
  'When true, this agent is included in the IDX round-robin assignment pool.';

comment on column public.agent_lead_routing.zip_coverage is
  '5-digit US ZIPs this agent services. Empty array = no ZIP constraint (eligible for any lead). Non-empty array narrows the pool when the lead has a ZIP that matches.';

comment on column public.agent_lead_routing.priority is
  'Reserved for future weighted round-robin. 0 = standard pool. Higher = preferred (assigned first when timestamps tie). Currently unused by the picker.';

-- ── triggers + indexes ───────────────────────────────────────────

create or replace function public.set_agent_lead_routing_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_lead_routing_set_updated_at on public.agent_lead_routing;
create trigger agent_lead_routing_set_updated_at
  before update on public.agent_lead_routing
  for each row execute procedure public.set_agent_lead_routing_updated_at();

-- Lookup pattern: load all agents in the pool. Filter on in_round_robin=true,
-- order by priority desc for the future weighted-rotation slot. Tiny table —
-- one row per agent — so the index isn't load-bearing today. Adding it
-- defensively for the day someone tries to scope this query in a join.
create index if not exists idx_agent_lead_routing_pool
  on public.agent_lead_routing (in_round_robin, priority desc)
  where in_round_robin = true;

-- ── RLS — agent can read/write their own row ─────────────────────

alter table public.agent_lead_routing enable row level security;

drop policy if exists "agent_lead_routing_select_own" on public.agent_lead_routing;
create policy "agent_lead_routing_select_own"
  on public.agent_lead_routing
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_lead_routing_insert_own" on public.agent_lead_routing;
create policy "agent_lead_routing_insert_own"
  on public.agent_lead_routing
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_lead_routing_update_own" on public.agent_lead_routing;
create policy "agent_lead_routing_update_own"
  on public.agent_lead_routing
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_lead_routing_delete_own" on public.agent_lead_routing;
create policy "agent_lead_routing_delete_own"
  on public.agent_lead_routing
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_lead_routing.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
