-- Rules-based deal prediction fields for prioritization and pipeline estimates.

alter table if exists public.leads
  add column if not exists close_probability integer default 0;

alter table if exists public.leads
  add column if not exists predicted_deal_value numeric default 0;

alter table if exists public.leads
  add column if not exists predicted_close_window text null;

alter table if exists public.leads
  add column if not exists prediction_factors_json jsonb not null default '[]'::jsonb;

alter table if exists public.leads
  add column if not exists prediction_updated_at timestamptz null;

comment on column public.leads.close_probability is 'Estimated close likelihood 0–100 (rules engine).';
comment on column public.leads.predicted_deal_value is 'Heuristic expected commission or deal value proxy (USD).';
comment on column public.leads.predicted_close_window is 'e.g. 0-7 days | 8-30 days | 31-90 days | 90+ days';
