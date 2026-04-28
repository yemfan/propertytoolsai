-- Per-agent sphere-drip enrollment toggle.
--
-- Promotes the env-allowlist scaffold (SPHERE_DRIP_ENABLED_AGENT_IDS)
-- to a DB-backed per-agent flag. PR #167 / #169 shipped the drip
-- enrollment + send pipelines; this migration removes the redeploy
-- friction so agents can flip themselves into / out of the cadence
-- from a settings panel without env changes.
--
-- Resolution order in lib/sphereDrip/runEnrollments.ts +
-- lib/sphereDrip/runSends.ts becomes:
--   1. DB rows where enabled = true (this table) — preferred
--   2. SPHERE_DRIP_ENABLED_AGENT_IDS env (back-compat fallback)
--   3. nothing — agent skipped
--
-- Migration is non-breaking: existing env-driven setups keep enrolling
-- contacts + sending touches exactly as before. The DB takes over the
-- moment any agent toggles "Enable sphere drip" via the UI.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260508000000_agent_lead_routing.sql.

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
      create table if not exists public.agent_sphere_drip_prefs (
        agent_id uuid primary key references public.agents(id) on delete cascade,
        enabled boolean not null default false,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_sphere_drip_prefs (
        agent_id bigint primary key references public.agents(id) on delete cascade,
        enabled boolean not null default false,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_sphere_drip_prefs: %', v_agent_type;
  end if;
end $$;

comment on table public.agent_sphere_drip_prefs is
  'Per-agent toggle for sphere-drip auto-enrollment + send pipeline. Replaces SPHERE_DRIP_ENABLED_AGENT_IDS env allowlist (env still acts as a back-compat fallback when no DB rows are enabled).';

comment on column public.agent_sphere_drip_prefs.enabled is
  'When true, the agent is included in /api/cron/sphere-drip-enroll runs (auto-enroll both_high contacts) AND /api/cron/sphere-drip-send runs (advance the cadence). Off by default — explicit opt-in.';

comment on column public.agent_sphere_drip_prefs.notes is
  'Free-text agent note about why they enabled / paused (e.g. "trying for Q3", "paused while on vacation"). Surfaced read-only on the settings panel.';

-- ── trigger + index ─────────────────────────────────────────────

create or replace function public.set_agent_sphere_drip_prefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_sphere_drip_prefs_set_updated_at on public.agent_sphere_drip_prefs;
create trigger agent_sphere_drip_prefs_set_updated_at
  before update on public.agent_sphere_drip_prefs
  for each row execute procedure public.set_agent_sphere_drip_prefs_updated_at();

-- The cron loop scans for enabled=true rows. Tiny table (one row per
-- agent) so the index isn't load-bearing today, but defensive vs.
-- future joins.
create index if not exists idx_agent_sphere_drip_prefs_enabled
  on public.agent_sphere_drip_prefs (enabled)
  where enabled = true;

-- ── RLS — agent reads/writes their own row only ──────────────────

alter table public.agent_sphere_drip_prefs enable row level security;

drop policy if exists "agent_sphere_drip_prefs_select_own" on public.agent_sphere_drip_prefs;
create policy "agent_sphere_drip_prefs_select_own"
  on public.agent_sphere_drip_prefs
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_sphere_drip_prefs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_sphere_drip_prefs_insert_own" on public.agent_sphere_drip_prefs;
create policy "agent_sphere_drip_prefs_insert_own"
  on public.agent_sphere_drip_prefs
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_sphere_drip_prefs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_sphere_drip_prefs_update_own" on public.agent_sphere_drip_prefs;
create policy "agent_sphere_drip_prefs_update_own"
  on public.agent_sphere_drip_prefs
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_sphere_drip_prefs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_sphere_drip_prefs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
