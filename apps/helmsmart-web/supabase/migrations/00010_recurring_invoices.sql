-- 00010_recurring_invoices.sql
-- Recurring invoice templates — generated automatically by the daily cron job.

create table if not exists public.recurring_invoices (
  id                  uuid          primary key default gen_random_uuid(),
  organization_id     uuid          not null references public.organizations(id) on delete cascade,
  client_id           uuid          references public.clients(id) on delete set null,

  -- Schedule
  frequency           text          not null
                                    check (frequency in ('weekly','monthly','quarterly','annually')),
  next_invoice_date   date          not null,
  last_generated_at   timestamptz,
  status              text          not null default 'active'
                                    check (status in ('active','paused')),

  -- Invoice template (copied verbatim to each generated invoice)
  title               text          not null default '',
  notes               text,
  tax_rate            numeric(5,4)  not null default 0,
  -- JSONB array of {description, quantity, unit_price}
  line_items          jsonb         not null default '[]',

  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

alter table public.recurring_invoices enable row level security;

create policy "org_members_recurring"
  on public.recurring_invoices
  for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

create index recurring_invoices_org_idx
  on public.recurring_invoices (organization_id);

-- Partial index for the cron: only active invoices that are due
create index recurring_invoices_due_idx
  on public.recurring_invoices (next_invoice_date)
  where status = 'active';
