-- Transaction Coordinator — agent-facing tracker for active deals in the
-- closing-phase window (mutual acceptance through keys-in-hand).
--
-- Motivation:
--   A buyer-rep agent spends 30-50 hours per deal in the closing phase
--   coordinating inspection, appraisal, loan, disclosures, title, and
--   wire transfer. Almost none of that work generates new leads —
--   it's pure operational overhead. Today agents track it in texts +
--   spreadsheets + memory. This schema gives them a structured place
--   to run a deal.
--
--   The existing client-portal pipeline (lib/clientPortalPipeline.ts)
--   exposes 7 stages to the BUYER for status transparency. This
--   transaction schema is the AGENT-side operational layer underneath
--   those stages.
--
-- Three tables:
--   * `transactions`            — one row per deal
--   * `transaction_tasks`       — the per-deal checklist (seeded from
--                                 lib/transactions/seedTasks.ts on
--                                 transaction create)
--   * `transaction_counterparties` — title / lender / inspector /
--                                    insurance contacts for the deal
--
-- Design notes:
--
--   * `agent_id` column type is detected at migration time — some
--     environments use uuid, others bigint. Same pattern as
--     20260479100000_message_templates.sql so the migration runs
--     against both shapes.
--   * Dates default to NULL and are filled in as the deal progresses.
--     When `mutual_acceptance_date` is set, the service layer auto-
--     fills California-standard contingency deadlines (17 days for
--     inspection, 21 for loan, 30 for close) unless the agent
--     overrides.
--   * Listing-side transactions are supported via `transaction_type`
--     but MVP seed tasks cover buyer_rep only. Listing-side seed
--     template is a follow-up.
--   * `contacts.closing_date` and `closing_price` (already present
--     for past-client anniversary messaging) are independent. When
--     a transaction closes, a service-layer hook backfills those
--     columns so anniversary / equity-milestone templates continue
--     to fire. Keeping them denormalized is intentional — the
--     anniversary workflow shouldn't need to JOIN a transaction
--     table for the common case.

-- ── transactions ──────────────────────────────────────────────────────
do $$
declare
  v_agent_type text;
begin
  -- Detect agents.id type.
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
      create table if not exists public.transactions (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        -- Identity of the deal
        transaction_type text not null default 'buyer_rep'
          check (transaction_type in ('buyer_rep', 'listing_rep', 'dual')),
        property_address text not null,
        city text,
        state text,
        zip text,
        purchase_price numeric,

        -- Status lifecycle
        status text not null default 'active'
          check (status in ('active', 'closed', 'terminated', 'pending')),
        terminated_reason text,

        -- Key dates. `mutual_acceptance_date` is the anchor; other
        -- deadlines are auto-filled from it on create/update.
        mutual_acceptance_date date,
        inspection_deadline date,
        inspection_completed_at date,
        appraisal_deadline date,
        appraisal_completed_at date,
        loan_contingency_deadline date,
        loan_contingency_removed_at date,
        closing_date date,              -- scheduled
        closing_date_actual date,       -- when it actually happened

        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create table if not exists public.transaction_tasks (
        id uuid primary key default gen_random_uuid(),
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        stage text not null
          check (stage in ('contract', 'inspection', 'appraisal', 'loan', 'closing')),
        title text not null,
        description text,
        due_date date,
        completed_at timestamptz,
        completed_by uuid references public.agents(id) on delete set null,
        order_index integer not null default 0,
        -- Stable identifier for seeded tasks (e.g. 'open_escrow', 'schedule_inspection').
        -- NULL for agent-created custom tasks. Used to skip re-seeding when the
        -- task set on the seed file evolves.
        seed_key text,
        source text not null default 'seed'
          check (source in ('seed', 'custom')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create table if not exists public.transaction_counterparties (
        id uuid primary key default gen_random_uuid(),
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        role text not null
          check (role in ('title', 'lender', 'inspector', 'insurance', 'co_agent', 'other')),
        name text not null,
        company text,
        email text,
        phone text,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.transactions (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        transaction_type text not null default 'buyer_rep'
          check (transaction_type in ('buyer_rep', 'listing_rep', 'dual')),
        property_address text not null,
        city text,
        state text,
        zip text,
        purchase_price numeric,

        status text not null default 'active'
          check (status in ('active', 'closed', 'terminated', 'pending')),
        terminated_reason text,

        mutual_acceptance_date date,
        inspection_deadline date,
        inspection_completed_at date,
        appraisal_deadline date,
        appraisal_completed_at date,
        loan_contingency_deadline date,
        loan_contingency_removed_at date,
        closing_date date,
        closing_date_actual date,

        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create table if not exists public.transaction_tasks (
        id uuid primary key default gen_random_uuid(),
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        stage text not null
          check (stage in ('contract', 'inspection', 'appraisal', 'loan', 'closing')),
        title text not null,
        description text,
        due_date date,
        completed_at timestamptz,
        completed_by bigint references public.agents(id) on delete set null,
        order_index integer not null default 0,
        seed_key text,
        source text not null default 'seed'
          check (source in ('seed', 'custom')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create table if not exists public.transaction_counterparties (
        id uuid primary key default gen_random_uuid(),
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        role text not null
          check (role in ('title', 'lender', 'inspector', 'insurance', 'co_agent', 'other')),
        name text not null,
        company text,
        email text,
        phone text,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;

  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

-- ── Indexes (shared across both agent-id flavors) ────────────────────
create index if not exists idx_transactions_agent
  on public.transactions(agent_id, status, closing_date);
create index if not exists idx_transactions_contact
  on public.transactions(contact_id);
create index if not exists idx_transactions_closing_date
  on public.transactions(closing_date)
  where status = 'active';

create index if not exists idx_transaction_tasks_transaction
  on public.transaction_tasks(transaction_id, order_index);
create index if not exists idx_transaction_tasks_due
  on public.transaction_tasks(transaction_id, due_date)
  where completed_at is null;
create unique index if not exists uniq_transaction_tasks_seed_key
  on public.transaction_tasks(transaction_id, seed_key)
  where seed_key is not null;

create index if not exists idx_transaction_counterparties_transaction
  on public.transaction_counterparties(transaction_id);

-- ── Comments ──────────────────────────────────────────────────────────
comment on table public.transactions is
  'Agent-facing transaction record — one row per active or closed deal. '
  'Distinct from contacts.closing_date which is a denormalized backfill for '
  'past-client anniversary messaging; a transaction represents the full '
  'coordination context (deadlines, tasks, counterparties).';
comment on column public.transactions.mutual_acceptance_date is
  'Ratified-contract date. Anchor for all other deadline defaults. '
  'When set (or updated), the service layer recomputes NULL-valued '
  'deadlines via California defaults (17 days inspection, 21 loan, '
  '30 closing) unless the agent has already overridden them.';
comment on column public.transaction_tasks.seed_key is
  'Stable id for seeded tasks (open_escrow, schedule_inspection, etc.). '
  'Partial unique index on (transaction_id, seed_key) prevents re-seeding '
  'the same task when the seed constants evolve. NULL for agent-custom tasks.';
