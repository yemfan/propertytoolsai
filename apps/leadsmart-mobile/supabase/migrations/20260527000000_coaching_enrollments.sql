-- LeadSmart AI Coaching enrollments.
--
-- The coaching layer (the gap-analysis differentiator) packages
-- two programs:
--   - 'producer_track'      — auto-enrolled on Pro+ (free)
--   - 'top_producer_track'  — bundled on Premium and Team
--
-- Program metadata lives in code (lib/coaching-programs/programs.ts)
-- so editing copy + targets doesn't require a migration. Enrollment
-- state is the only thing the DB has to track:
--   - One row per (agent, program)
--   - opted_out_at lets the agent leave the program without losing
--     historic enrollment context
--   - Re-enrollment (re-set opted_out_at to null) is allowed
--
-- agent_id type adapts to public.agents.id (uuid OR bigint), same
-- pattern as the recent migrations.

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
      create table if not exists public.coaching_enrollments (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        program_slug text not null check (program_slug in (
          'producer_track','top_producer_track'
        )),
        enrolled_at timestamptz not null default now(),
        opted_out_at timestamptz null,
        opt_out_reason text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, program_slug)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.coaching_enrollments (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        program_slug text not null check (program_slug in (
          'producer_track','top_producer_track'
        )),
        enrolled_at timestamptz not null default now(),
        opted_out_at timestamptz null,
        opt_out_reason text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, program_slug)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.coaching_enrollments is
  'Per-agent enrollment state for LeadSmart AI Coaching programs (Producer Track, Top Producer Track). Program metadata + targets live in lib/coaching-programs/programs.ts.';

comment on column public.coaching_enrollments.opted_out_at is
  'Set when the agent opts out. Re-enrollment is allowed by clearing this back to NULL — preserves historical context vs deleting the row.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_coaching_enrollments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coaching_enrollments_set_updated_at on public.coaching_enrollments;
create trigger coaching_enrollments_set_updated_at
  before update on public.coaching_enrollments
  for each row execute procedure public.set_coaching_enrollments_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

-- "Show me my active enrollments" — dashboard hot path. Partial
-- index on the active subset keeps it small.
create index if not exists idx_coaching_enrollments_agent_active
  on public.coaching_enrollments (agent_id)
  where opted_out_at is null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.coaching_enrollments enable row level security;

drop policy if exists "coaching_enrollments_select_own" on public.coaching_enrollments;
create policy "coaching_enrollments_select_own"
  on public.coaching_enrollments
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_enrollments_insert_own" on public.coaching_enrollments;
create policy "coaching_enrollments_insert_own"
  on public.coaching_enrollments
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = coaching_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_enrollments_update_own" on public.coaching_enrollments;
create policy "coaching_enrollments_update_own"
  on public.coaching_enrollments
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = coaching_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = coaching_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
