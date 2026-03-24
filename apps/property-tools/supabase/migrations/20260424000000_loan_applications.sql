-- Loan broker pipeline (`lib/dashboard/loanBroker.ts`, `LOAN_APPLICATIONS_*` in schemaConfig).
-- Apply when you are ready: `supabase db push` / your usual migration flow.
-- Inserts and product flows can be added later; the dashboard tolerates an empty table.

create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  assigned_broker_id text not null,
  status text not null default 'new_inquiry',
  borrower_name text,
  loan_amount numeric,
  readiness text,
  docs_pending_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend older or hand-created tables without breaking if columns already exist.
alter table public.loan_applications
  add column if not exists assigned_broker_id text;

alter table public.loan_applications
  add column if not exists status text;

alter table public.loan_applications
  add column if not exists borrower_name text;

alter table public.loan_applications
  add column if not exists loan_amount numeric;

alter table public.loan_applications
  add column if not exists readiness text;

alter table public.loan_applications
  add column if not exists docs_pending_count integer;

alter table public.loan_applications
  add column if not exists created_at timestamptz;

alter table public.loan_applications
  add column if not exists updated_at timestamptz;

-- Defaults / NOT NULL for rows touched after columns are added piecemeal
alter table public.loan_applications
  alter column docs_pending_count set default 0;

alter table public.loan_applications
  alter column status set default 'new_inquiry';

update public.loan_applications
set created_at = coalesce(created_at, updated_at, now()),
    updated_at = coalesce(updated_at, now())
where created_at is null or updated_at is null;

alter table public.loan_applications
  alter column created_at set default now();

alter table public.loan_applications
  alter column updated_at set default now();

alter table public.loan_applications
  alter column created_at set not null;

alter table public.loan_applications
  alter column updated_at set not null;

create index if not exists idx_loan_applications_assigned_broker_id
  on public.loan_applications(assigned_broker_id);

create index if not exists idx_loan_applications_created_at
  on public.loan_applications(created_at desc);

drop trigger if exists trg_loan_applications_updated_at on public.loan_applications;
create trigger trg_loan_applications_updated_at
before update on public.loan_applications
for each row
execute function public.set_updated_at();

comment on table public.loan_applications is 'Loan broker pipeline; dashboard reads by assigned_broker_id. Populate via your product/API when ready.';
