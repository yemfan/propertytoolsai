-- Week 36: recurring projects (retainers).
-- A template that auto-spawns a fresh project on a schedule — e.g. a monthly
-- retainer's work. Mirrors the recurring_invoices pattern.

create table if not exists recurring_projects (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  client_id         uuid references clients(id) on delete set null,
  name              text not null,
  description       text,
  color             text not null default 'indigo',
  budget_hours      numeric(10,2),
  budget_amount     numeric(12,2),
  hourly_rate       numeric(10,2),
  frequency         text not null default 'monthly'
                      check (frequency in ('weekly', 'monthly', 'quarterly', 'annually')),
  next_run_date     date not null,
  status            text not null default 'active' check (status in ('active', 'paused')),
  last_generated_at timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_recurring_projects_org
  on recurring_projects (organization_id, created_at desc);
create index if not exists idx_recurring_projects_due
  on recurring_projects (status, next_run_date);

alter table recurring_projects enable row level security;

create policy "members manage recurring_projects"
  on recurring_projects
  for all
  using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
