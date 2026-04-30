-- Per-agent coaching insight dismissals.
--
-- The coaching dashboard (PR #175) surfaces 5 nudges. Without a way to
-- snooze them, agents see the same "you have 8 stale past clients"
-- card every visit even after they've acknowledged it. This table
-- stores per-agent, per-insight TTL dismissals so the service-side
-- filter can hide an insight until the timestamp passes.
--
-- One row per (agent, insight_id). Re-dismissing the same insight
-- updates `dismissed_until` in place via upsert.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260514000000_agent_social_connections.sql.

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
      create table if not exists public.coaching_dismissals (
        agent_id uuid not null references public.agents(id) on delete cascade,
        insight_id text not null,
        dismissed_until timestamptz not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (agent_id, insight_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.coaching_dismissals (
        agent_id bigint not null references public.agents(id) on delete cascade,
        insight_id text not null,
        dismissed_until timestamptz not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (agent_id, insight_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.coaching_dismissals is
  'Per-agent TTL snooze for coaching-dashboard insights. PK on (agent_id, insight_id) enforces one row per insight per agent; upsert refreshes dismissed_until on re-snooze.';

comment on column public.coaching_dismissals.dismissed_until is
  'When this insight becomes visible again. The service-side filter compares against now() and excludes dismissed insights from the response.';

-- ── trigger ─────────────────────────────────────────────────────

create or replace function public.set_coaching_dismissals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coaching_dismissals_set_updated_at on public.coaching_dismissals;
create trigger coaching_dismissals_set_updated_at
  before update on public.coaching_dismissals
  for each row execute procedure public.set_coaching_dismissals_updated_at();

-- ── index ───────────────────────────────────────────────────────

-- The lookup pattern is "for this agent, give me the still-active
-- dismissals." Partial index keeps it small + fast.
create index if not exists idx_coaching_dismissals_active
  on public.coaching_dismissals (agent_id, dismissed_until desc);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.coaching_dismissals enable row level security;

drop policy if exists "coaching_dismissals_select_own" on public.coaching_dismissals;
create policy "coaching_dismissals_select_own"
  on public.coaching_dismissals
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_dismissals_insert_own" on public.coaching_dismissals;
create policy "coaching_dismissals_insert_own"
  on public.coaching_dismissals
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_dismissals_update_own" on public.coaching_dismissals;
create policy "coaching_dismissals_update_own"
  on public.coaching_dismissals
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_dismissals_delete_own" on public.coaching_dismissals;
create policy "coaching_dismissals_delete_own"
  on public.coaching_dismissals
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_dismissals.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
