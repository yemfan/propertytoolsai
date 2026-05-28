-- Week 38: Bills (accounts payable) — track what you owe vendors.
-- Cash-basis: recording a bill is a tracked obligation only. The expense
-- journal entry (DR expense / CR bank) is posted when the bill is PAID, so
-- the cash-basis P&L stays clean. A/P aging is a management view over open
-- bills (sum by days-until/past the due date).

create table if not exists bills (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  vendor                text not null,
  description           text,
  bill_number           text,
  expense_account_id    uuid references chart_of_accounts(id) on delete set null,
  issue_date            date not null default current_date,
  due_date              date not null,
  amount                numeric(12,2) not null check (amount >= 0),
  status                text not null default 'open' check (status in ('open', 'paid')),
  paid_at               timestamptz,
  paid_bank_account_id  uuid references bank_accounts(id) on delete set null,
  journal_entry_id      uuid references journal_entries(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists idx_bills_org_status
  on bills (organization_id, status, due_date);

alter table bills enable row level security;

create policy "members manage bills"
  on bills
  for all
  using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
