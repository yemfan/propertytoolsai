-- Smart-list sphere drip enrollments.
--
-- The sphere monetization view (PR #163) surfaces "both_high" leverage
-- contacts — past clients / sphere who score high on BOTH the seller-
-- prediction and buyer-prediction engines (concurrent sell-then-buy
-- candidates). This table tracks which of those contacts have been
-- auto-enrolled into a structured 6-touch nurture cadence so the
-- agent can work them systematically instead of from a flat list.
--
-- One row per (agent, contact, cadence_key). The unique index ensures
-- re-running the auto-enroll cron is idempotent — a contact already
-- enrolled stays in the same state without producing a duplicate row.
--
-- Send pipeline is OUT-OF-SCOPE for this migration. This table tracks
-- enrollment + step + next-due-at; the actual touch send (SMS / email
-- via the existing scheduler / drafts pipeline) will land in a
-- follow-up PR. Today the agent acts on next_due_at manually.
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
      create table if not exists public.sphere_drip_enrollments (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,
        cadence_key text not null,
        enrolled_at timestamptz not null default now(),
        current_step int not null default 0
          check (current_step >= 0 and current_step <= 100),
        status text not null default 'active'
          check (status in ('active', 'paused', 'completed', 'exited')),
        last_sent_at timestamptz,
        next_due_at timestamptz,
        completed_at timestamptz,
        exit_reason text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, contact_id, cadence_key)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.sphere_drip_enrollments (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,
        cadence_key text not null,
        enrolled_at timestamptz not null default now(),
        current_step int not null default 0
          check (current_step >= 0 and current_step <= 100),
        status text not null default 'active'
          check (status in ('active', 'paused', 'completed', 'exited')),
        last_sent_at timestamptz,
        next_due_at timestamptz,
        completed_at timestamptz,
        exit_reason text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, contact_id, cadence_key)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for sphere_drip_enrollments: %', v_agent_type;
  end if;
end $$;

comment on table public.sphere_drip_enrollments is
  'Per-(agent, contact, cadence) sphere-drip enrollment state. Tracks current step + next-due-at for systematic nurture of the both_high cohort surfaced by the sphere-monetization view.';

comment on column public.sphere_drip_enrollments.cadence_key is
  'Identifier for the cadence definition. Today: "both_high_v1" (6 steps over ~30 days). Pinning the version so a future v2 cadence can coexist.';

comment on column public.sphere_drip_enrollments.current_step is
  'Zero-based index of the next step to send. 0 = enrolled but no touch yet. Equals total step count when status=completed.';

comment on column public.sphere_drip_enrollments.status is
  'active = working through steps. paused = agent manually held. completed = all steps sent. exited = removed from cohort (manual or via auto-exit when contact leaves both_high).';

-- ── triggers + indexes ───────────────────────────────────────────

create or replace function public.set_sphere_drip_enrollments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sphere_drip_enrollments_set_updated_at on public.sphere_drip_enrollments;
create trigger sphere_drip_enrollments_set_updated_at
  before update on public.sphere_drip_enrollments
  for each row execute procedure public.set_sphere_drip_enrollments_updated_at();

-- The send pipeline (when wired) will scan for due enrollments via
-- this index. Active rows only — completed / exited / paused don't
-- need to be looked at on every tick.
create index if not exists idx_sphere_drip_enrollments_due
  on public.sphere_drip_enrollments (next_due_at, agent_id)
  where status = 'active';

create index if not exists idx_sphere_drip_enrollments_agent_contact
  on public.sphere_drip_enrollments (agent_id, contact_id);

-- ── RLS ──────────────────────────────────────────────────────────

alter table public.sphere_drip_enrollments enable row level security;

drop policy if exists "sphere_drip_enrollments_select_own" on public.sphere_drip_enrollments;
create policy "sphere_drip_enrollments_select_own"
  on public.sphere_drip_enrollments
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "sphere_drip_enrollments_insert_own" on public.sphere_drip_enrollments;
create policy "sphere_drip_enrollments_insert_own"
  on public.sphere_drip_enrollments
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "sphere_drip_enrollments_update_own" on public.sphere_drip_enrollments;
create policy "sphere_drip_enrollments_update_own"
  on public.sphere_drip_enrollments
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "sphere_drip_enrollments_delete_own" on public.sphere_drip_enrollments;
create policy "sphere_drip_enrollments_delete_own"
  on public.sphere_drip_enrollments
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = sphere_drip_enrollments.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
