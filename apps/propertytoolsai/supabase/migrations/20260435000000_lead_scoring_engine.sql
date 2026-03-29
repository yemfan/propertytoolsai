-- Core CRM lead scoring (0–100) + temperature for agent prioritization.
-- last_activity_at may already exist from engagement migrations; ensure columns only.

alter table if exists public.leads
  add column if not exists lead_score integer not null default 0;

alter table if exists public.leads
  add column if not exists lead_temperature text not null default 'cold';

alter table if exists public.leads
  add column if not exists last_activity_at timestamptz;

create index if not exists idx_leads_lead_score_desc on public.leads (lead_score desc nulls last);

comment on column public.leads.lead_score is 'Rules-based conversion score 0–100 (product engine)';
comment on column public.leads.lead_temperature is 'hot | warm | cold (derived from lead_score)';
