-- Realtor business-expense tracking (bookkeeping for taxes). A realtor's income
-- is commission; their bookkeeping pain is logging COSTS — marketing, mileage,
-- MLS/NAR dues, signage, staging, client gifts, CE — categorized for tax time.
-- agent_id -> agents.id (bigint). receipt_url points at an uploaded receipt image.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null,
  expense_date date not null default current_date,
  amount numeric(12, 2) not null default 0,
  category text not null default 'Other',
  vendor text,
  notes text,
  receipt_url text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_agent_date_idx on public.expenses (agent_id, expense_date desc);

comment on table public.expenses is
  'Realtor business expenses for bookkeeping/taxes. agent_id -> agents.id.';
