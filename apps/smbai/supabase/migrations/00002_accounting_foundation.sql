-- ─── Accounting foundation ────────────────────────────────────────────────────
-- Double-entry, cash-basis bookkeeping.
-- Journal entries are IMMUTABLE — corrections via reversing entries only.
-- sum(debit) = sum(credit) is enforced at the service layer per transaction;
-- the debit_or_credit check constraint prevents mixed lines.
--
-- ⚠ CPA REVIEW REQUIRED before populating tax_line_code values.
-- The column exists but all seeds use NULL until a CPA validates the
-- Schedule C / 1120-S / 1065 line-item mappings for each entity type.

-- Chart of accounts
create table if not exists chart_of_accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  code             text not null,
  name             text not null,
  type             text not null
                     check (type in ('asset','liability','equity','revenue','expense')),
  normal_balance   text not null
                     check (normal_balance in ('debit','credit')),
  -- ⚠ CPA review required — do not set production values until validated
  tax_line_code    text,
  parent_account_id uuid references chart_of_accounts(id),
  is_active        boolean not null default true,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, code)
);

-- Journal entries (append-only — no UPDATE or DELETE permitted via RLS)
create table if not exists journal_entries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  date             date not null,
  memo             text,
  source_type      text not null
                     check (source_type in (
                       'bank_import','invoice','expense',
                       'adjustment','opening_balance','period_close','reversal'
                     )),
  source_id        uuid,
  is_reversal      boolean not null default false,
  -- Populated when this entry reverses another
  reversed_entry_id uuid references journal_entries(id),
  -- Populated on the original entry when it has been reversed
  reversed_by_entry_id uuid references journal_entries(id),
  posted_by        uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

-- Journal lines (each line is either a debit or a credit, never both)
create table if not exists journal_lines (
  id               uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete restrict,
  account_id       uuid not null references chart_of_accounts(id),
  debit            numeric(19,4) not null default 0 check (debit  >= 0),
  credit           numeric(19,4) not null default 0 check (credit >= 0),
  description      text,
  created_at       timestamptz not null default now(),
  -- A line must be either a debit or a credit, not zero, not both
  constraint debit_xor_credit check (
    (debit > 0 and credit = 0) or
    (debit = 0 and credit > 0)
  )
);

-- Accounting periods
create table if not exists accounting_periods (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  period_start     date not null,
  period_end       date not null,
  status           text not null default 'open'
                     check (status in ('open','closing','closed')),
  closed_at        timestamptz,
  closed_by        uuid references auth.users(id),
  closing_entry_id uuid references journal_entries(id),
  created_at       timestamptz not null default now(),
  unique (organization_id, period_start, period_end)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table chart_of_accounts  enable row level security;
alter table journal_entries     enable row level security;
alter table journal_lines       enable row level security;
alter table accounting_periods  enable row level security;

-- chart_of_accounts
create policy "org members can view accounts"
  on chart_of_accounts for select
  using (organization_id in (select get_user_org_ids()));

create policy "bookkeepers+ can manage accounts"
  on chart_of_accounts for all
  using (
    organization_id in (
      select organization_id from organization_members
      where  user_id = auth.uid()
      and    role in ('owner','admin','bookkeeper')
    )
  );

-- journal_entries: SELECT + INSERT only — no UPDATE, no DELETE
create policy "org members can view journal entries"
  on journal_entries for select
  using (organization_id in (select get_user_org_ids()));

create policy "bookkeepers+ can post journal entries"
  on journal_entries for insert
  with check (
    organization_id in (
      select organization_id from organization_members
      where  user_id = auth.uid()
      and    role in ('owner','admin','bookkeeper')
    )
  );

-- journal_lines: SELECT + INSERT only
create policy "org members can view journal lines"
  on journal_lines for select
  using (
    journal_entry_id in (
      select id from journal_entries
      where  organization_id in (select get_user_org_ids())
    )
  );

create policy "bookkeepers+ can insert journal lines"
  on journal_lines for insert
  with check (
    journal_entry_id in (
      select id from journal_entries
      where  organization_id in (
        select organization_id from organization_members
        where  user_id = auth.uid()
        and    role in ('owner','admin','bookkeeper')
      )
    )
  );

-- accounting_periods
create policy "org members can view periods"
  on accounting_periods for select
  using (organization_id in (select get_user_org_ids()));

create policy "owners/admins can manage periods"
  on accounting_periods for all
  using (
    organization_id in (
      select organization_id from organization_members
      where  user_id = auth.uid()
      and    role in ('owner','admin')
    )
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_coa_org
  on chart_of_accounts(organization_id);
create index if not exists idx_journal_entries_org_date
  on journal_entries(organization_id, date desc);
create index if not exists idx_journal_lines_entry
  on journal_lines(journal_entry_id);
create index if not exists idx_journal_lines_account
  on journal_lines(account_id);
create index if not exists idx_accounting_periods_org
  on accounting_periods(organization_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

create trigger chart_of_accounts_updated_at
  before update on chart_of_accounts
  for each row execute function set_updated_at();
