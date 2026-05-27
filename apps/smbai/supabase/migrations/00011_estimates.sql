-- 00011_estimates.sql
-- Client estimates (quotes) that can be sent, accepted, and converted to invoices.

create table if not exists estimates (
  id                    uuid          primary key default gen_random_uuid(),
  organization_id       uuid          not null references organizations(id) on delete cascade,
  client_id             uuid          references clients(id) on delete set null,

  estimate_number       text          not null,
  status                text          not null default 'draft'
                                      check (status in ('draft','sent','accepted','declined','expired')),

  issue_date            date          not null default current_date,
  expiry_date           date          not null,

  subtotal              numeric(12,2) not null default 0,
  tax_rate              numeric(5,4)  not null default 0,
  tax_amount            numeric(12,2) not null default 0,
  total                 numeric(12,2) not null default 0,

  notes                 text,
  -- Populated when accepted and converted
  converted_invoice_id  uuid          references invoices(id) on delete set null,

  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

create unique index if not exists idx_estimates_org_number
  on estimates(organization_id, estimate_number);

create index if not exists idx_estimates_org_status
  on estimates(organization_id, status, expiry_date desc);

alter table estimates enable row level security;

create policy "members_select_estimates" on estimates
  for select using (organization_id in (select get_user_org_ids()));

create policy "members_insert_estimates" on estimates
  for insert with check (organization_id in (select get_user_org_ids()));

create policy "members_update_estimates" on estimates
  for update using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

-- ─── Estimate line items ──────────────────────────────────────────────────────

create table if not exists estimate_lines (
  id            uuid          primary key default gen_random_uuid(),
  estimate_id   uuid          not null references estimates(id) on delete cascade,
  description   text          not null,
  quantity      numeric(10,2) not null default 1,
  unit_price    numeric(12,2) not null,
  amount        numeric(12,2) not null,
  sort_order    int           not null default 0,
  created_at    timestamptz   not null default now()
);

create index if not exists idx_estimate_lines_estimate
  on estimate_lines(estimate_id, sort_order);

alter table estimate_lines enable row level security;

create policy "members_select_estimate_lines" on estimate_lines
  for select using (
    estimate_id in (
      select id from estimates
      where organization_id in (select get_user_org_ids())
    )
  );

create policy "members_insert_estimate_lines" on estimate_lines
  for insert with check (
    estimate_id in (
      select id from estimates
      where organization_id in (select get_user_org_ids())
    )
  );

create policy "members_delete_estimate_lines" on estimate_lines
  for delete using (
    estimate_id in (
      select id from estimates
      where organization_id in (select get_user_org_ids())
    )
  );
