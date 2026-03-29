-- Optional CRM conversion rows for revenue / ROI dashboards (admin performance).
-- No FK to leads to stay compatible if legacy DBs use mixed id types.

create table if not exists public.lead_conversions (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  agent_id text null,
  gross_commission numeric(14, 2) not null default 0,
  recurring_revenue numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_conversions_lead_id on public.lead_conversions (lead_id);
create index if not exists idx_lead_conversions_agent_id on public.lead_conversions (agent_id);
create index if not exists idx_lead_conversions_created_at on public.lead_conversions (created_at desc);

comment on table public.lead_conversions is
  'Closed-won style rows for gross commission / recurring revenue attribution (admin performance).';
