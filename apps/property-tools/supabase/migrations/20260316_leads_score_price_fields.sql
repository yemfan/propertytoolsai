-- Lead marketplace scoring + pricing columns (rules-based engine; safe to re-run)

alter table if exists public.leads
  add column if not exists score int;

alter table if exists public.leads
  add column if not exists price numeric(12, 2);

-- intent may already exist from prior migration
alter table if exists public.leads
  add column if not exists intent text;

alter table if exists public.leads
  add column if not exists timeframe text;

alter table if exists public.leads
  add column if not exists property_value numeric(14, 2);

alter table if exists public.leads
  add column if not exists location text;

alter table if exists public.leads
  add column if not exists tool_used text;

create index if not exists idx_leads_score_desc on public.leads(score desc nulls last);
create index if not exists idx_leads_price_desc on public.leads(price desc nulls last);

comment on column public.leads.score is 'Rules/ML lead score 0–100 (product engine)';
comment on column public.leads.price is 'Suggested lead price USD (marketplace / monetization)';
