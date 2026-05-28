-- Week 27: project profitability / P&L.
-- Attribute expenses to projects and capture labor cost so each project's
-- margin can be computed: revenue (invoiced time) − labor cost − expenses.

-- Expenses are journal entries (source_type = 'expense'); tag them to a project.
alter table journal_entries
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists idx_journal_entries_project
  on journal_entries (organization_id, project_id)
  where project_id is not null;

-- Per-entry labor cost rate: what an hour costs the business, distinct from
-- the billable hourly_rate. Null → fall back to the org default below.
alter table time_entries
  add column if not exists cost_rate numeric(10,2);

-- Org-level default labor cost rate, used when a time entry has no cost_rate.
alter table organizations
  add column if not exists default_labor_cost_rate numeric(10,2);
