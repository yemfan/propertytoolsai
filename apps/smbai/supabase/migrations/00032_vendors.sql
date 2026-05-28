-- Week 43: vendors — a lightweight directory of the people/companies you pay.
-- Standalone: per-vendor spend is matched to bills by vendor name (case-
-- insensitive), so there are no schema changes to bills/recurring_bills. Stores
-- contact info + notes and powers vendor-name autocomplete on the bill forms.

create table if not exists vendors (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  email           text,
  phone           text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_vendors_org on vendors (organization_id, name);

alter table vendors enable row level security;

create policy "members manage vendors"
  on vendors
  for all
  using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
