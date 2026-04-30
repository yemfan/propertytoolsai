-- CMA (Comparative Market Analysis) reports per agent.
--
-- The actual valuation engine + comp pipeline lives in the
-- propertytoolsai app (lib/valuation/* and /api/smart-cma). This table
-- captures the OUTPUT of one of those runs as a snapshot owned by an
-- agent in the CRM, so the agent can:
--   * Browse historical CMAs (one row per generation event)
--   * Re-show a past CMA to a seller without re-running it
--   * Optionally link the CMA to a contact (the seller-prospect)
--
-- We intentionally don't normalize comps into their own rows — they
-- live as a JSON snapshot inside `comps_json` so the report stays
-- frozen even if the underlying property warehouse data shifts. The
-- denormalized columns (estimated_value, low_estimate, etc.) exist
-- so the list view can sort/filter without parsing JSON.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260510000000_inbound_contact_requests.sql etc.

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
      create table if not exists public.cma_reports (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        -- Subject + comps + valuation snapshots (JSON for stability against
        -- upstream property-warehouse churn).
        subject_address text not null,
        subject_json jsonb not null,
        comps_json jsonb not null,
        valuation_json jsonb not null,
        strategies_json jsonb,

        -- Denormalized for list-view sort/filter without JSON parsing.
        estimated_value numeric(15, 2),
        low_estimate numeric(15, 2),
        high_estimate numeric(15, 2),
        confidence_score int,
        comp_count int not null default 0,

        title text,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.cma_reports (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        subject_address text not null,
        subject_json jsonb not null,
        comps_json jsonb not null,
        valuation_json jsonb not null,
        strategies_json jsonb,

        estimated_value numeric(15, 2),
        low_estimate numeric(15, 2),
        high_estimate numeric(15, 2),
        confidence_score int,
        comp_count int not null default 0,

        title text,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for cma_reports: %', v_agent_type;
  end if;
end $$;

comment on table public.cma_reports is
  'Per-agent Comparative Market Analysis snapshots. The valuation engine + comps live in propertytoolsai/lib/valuation; this table snapshots one run for the agent to retain, share, and link to a seller-prospect contact.';

comment on column public.cma_reports.subject_json is
  'Subject property snapshot at the time of the CMA run: address, beds, baths, sqft, year_built, condition, etc.';

comment on column public.cma_reports.comps_json is
  'Array of comparable sales the engine selected, frozen at the time of the run. Each entry: address, price, sqft, beds, baths, distanceMiles, soldDate, propertyType, pricePerSqft.';

comment on column public.cma_reports.valuation_json is
  'Top-level valuation result: estimatedValue, low, high, avgPricePerSqft, plus any engine metadata.';

comment on column public.cma_reports.strategies_json is
  'Listing-strategy bands the engine returned (aggressive / market / premium with daysOnMarket projections). Optional — older runs may not include this.';

-- ── triggers + indexes ──────────────────────────────────────────

create or replace function public.set_cma_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cma_reports_set_updated_at on public.cma_reports;
create trigger cma_reports_set_updated_at
  before update on public.cma_reports
  for each row execute procedure public.set_cma_reports_updated_at();

create index if not exists idx_cma_reports_agent_created
  on public.cma_reports (agent_id, created_at desc);

create index if not exists idx_cma_reports_contact
  on public.cma_reports (contact_id)
  where contact_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.cma_reports enable row level security;

drop policy if exists "cma_reports_select_own" on public.cma_reports;
create policy "cma_reports_select_own"
  on public.cma_reports
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "cma_reports_insert_own" on public.cma_reports;
create policy "cma_reports_insert_own"
  on public.cma_reports
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "cma_reports_update_own" on public.cma_reports;
create policy "cma_reports_update_own"
  on public.cma_reports
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "cma_reports_delete_own" on public.cma_reports;
create policy "cma_reports_delete_own"
  on public.cma_reports
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = cma_reports.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
