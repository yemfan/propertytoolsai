-- 00006_invoices.sql
-- Client invoicing with line items.
-- Cash-basis: revenue posted only when invoice is marked paid.

create table if not exists invoices (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  client_id       uuid        references clients(id) on delete set null,

  invoice_number  text        not null,
  status          text        not null default 'draft'
                              check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),

  issue_date      date        not null default current_date,
  due_date        date        not null,

  subtotal        numeric(12,2) not null default 0,
  tax_rate        numeric(5,4) not null default 0,    -- e.g. 0.0875 = 8.75%
  tax_amount      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,

  notes           text,
  paid_at         timestamptz,
  journal_entry_id uuid       references journal_entries(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_invoices_org_number
  on invoices(organization_id, invoice_number);

create index if not exists idx_invoices_org_status
  on invoices(organization_id, status, due_date desc);

alter table invoices enable row level security;

create policy "members_select_invoices" on invoices
  for select using (organization_id in (select get_user_org_ids()));

create policy "members_insert_invoices" on invoices
  for insert with check (organization_id in (select get_user_org_ids()));

create policy "members_update_invoices" on invoices
  for update using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

-- ─── Invoice line items ───────────────────────────────────────────────────────

create table if not exists invoice_lines (
  id              uuid        primary key default gen_random_uuid(),
  invoice_id      uuid        not null references invoices(id) on delete cascade,

  description     text        not null,
  quantity        numeric(10,2) not null default 1,
  unit_price      numeric(12,2) not null,
  amount          numeric(12,2) not null,       -- quantity * unit_price

  coa_account_id  uuid        references chart_of_accounts(id) on delete set null,

  sort_order      int         not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_invoice_lines_invoice
  on invoice_lines(invoice_id, sort_order);

alter table invoice_lines enable row level security;

-- Line items inherit org-level security through invoice join
create policy "members_select_invoice_lines" on invoice_lines
  for select using (
    invoice_id in (
      select id from invoices
      where organization_id in (select get_user_org_ids())
    )
  );

create policy "members_insert_invoice_lines" on invoice_lines
  for insert with check (
    invoice_id in (
      select id from invoices
      where organization_id in (select get_user_org_ids())
    )
  );

create policy "members_delete_invoice_lines" on invoice_lines
  for delete using (
    invoice_id in (
      select id from invoices
      where organization_id in (select get_user_org_ids())
    )
  );
