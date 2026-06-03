-- ============================================================
-- Migration 00040: Payee category memory
-- ============================================================
-- Remembers which chart-of-accounts category the owner assigned to a given
-- payee, so repeat vendors auto-categorize (skip the AI) and the owner stops
-- re-reviewing the same merchants every bank sync. Updated on each approval,
-- so corrections stick.
-- ============================================================

create table if not exists payee_categories (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  payee_key       text        not null,          -- normalized merchant name
  coa_account_id  uuid        not null references chart_of_accounts(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, payee_key)
);

create index if not exists payee_categories_org_idx on payee_categories(organization_id);

alter table payee_categories enable row level security;

create policy "org_members_payee_categories" on payee_categories
  for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

create trigger set_updated_at_payee_categories
  before update on payee_categories
  for each row execute function set_updated_at();
