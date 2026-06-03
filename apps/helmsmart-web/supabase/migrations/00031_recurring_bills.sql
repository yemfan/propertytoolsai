-- Week 40: recurring bills — auto-generate repeating vendor bills (rent, SaaS,
-- insurance, retainers you pay out). Mirrors recurring_projects: an active
-- template spawns a fresh open bill each cycle (due_date = issue + due_days),
-- then advances next_run_date by its frequency. Feeds the A/P aging + cash-flow
-- forecast as the generated bills come due.

create table if not exists recurring_bills (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  vendor             text not null,
  description        text,
  expense_account_id uuid references chart_of_accounts(id) on delete set null,
  amount             numeric(12,2) not null check (amount >= 0),
  due_days           int not null default 30 check (due_days >= 0),
  frequency          text not null default 'monthly'
                       check (frequency in ('weekly', 'monthly', 'quarterly', 'annually')),
  next_run_date      date not null,
  status             text not null default 'active' check (status in ('active', 'paused')),
  last_generated_at  timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists idx_recurring_bills_org
  on recurring_bills (organization_id, created_at desc);
create index if not exists idx_recurring_bills_due
  on recurring_bills (status, next_run_date);

alter table recurring_bills enable row level security;

create policy "members manage recurring_bills"
  on recurring_bills
  for all
  using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
