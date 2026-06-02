-- LeadSmart bookkeeping (v1): simple client invoicing (AR).
--
-- A realtor bills a contact for services (e.g. a transaction-coordination fee,
-- a consultation, a referral) and tracks it through draft -> sent -> paid. Flat
-- money math (subtotal + tax = total) — intentionally NOT the double-entry
-- accounting smbai runs; realtors want "who owes me what," not a general ledger.
--
-- client_name / client_email are denormalized so an invoice is self-contained
-- (sendable) even when contact_id is null. agent_id -> agents.id (bigint).

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null,
  contact_id text,
  client_name text,
  client_email text,
  invoice_number text not null,
  status text not null default 'draft',   -- draft | sent | paid | overdue | void
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'USD',
  subtotal numeric(12, 2) not null default 0,
  tax_rate numeric(6, 4) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  amount numeric(12, 2) not null default 0,
  sort_order int not null default 0
);

create index if not exists invoices_agent_idx on public.invoices (agent_id, created_at desc);
create unique index if not exists invoices_agent_number_uidx on public.invoices (agent_id, invoice_number);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id, sort_order);

comment on table public.invoices is
  'Simple client invoices (AR) for the LeadSmart realtor. agent_id -> agents.id. Flat money math, not double-entry.';
