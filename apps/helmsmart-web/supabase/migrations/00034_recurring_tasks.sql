-- Week 48: recurring tasks — auto-generate repeating to-dos (payroll, quarterly
-- filings, license renewals, weekly reviews). Mirrors recurring_projects: an
-- active template spawns a fresh open task (due_date = next_run_date) each
-- cycle, then advances next_run_date by its frequency.

create table if not exists recurring_tasks (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  client_id         uuid references clients(id) on delete set null,
  title             text not null,
  notes             text,
  priority          text not null default 'normal'
                      check (priority in ('low', 'normal', 'high', 'urgent')),
  frequency         text not null default 'weekly'
                      check (frequency in ('weekly', 'monthly', 'quarterly', 'annually')),
  next_run_date     date not null,
  status            text not null default 'active' check (status in ('active', 'paused')),
  last_generated_at timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_recurring_tasks_org
  on recurring_tasks (organization_id, created_at desc);
create index if not exists idx_recurring_tasks_due
  on recurring_tasks (status, next_run_date);

alter table recurring_tasks enable row level security;

create policy "members manage recurring_tasks"
  on recurring_tasks
  for all
  using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
