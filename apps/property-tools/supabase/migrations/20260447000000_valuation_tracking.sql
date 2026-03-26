-- Valuation run logging + actual sale outcomes for accuracy metrics.

create table if not exists public.valuation_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint null references public.leads (id) on delete set null,
  property_address text not null,
  city text null,
  state text null,
  zip text null,
  property_type text null,
  beds numeric null,
  baths numeric null,
  sqft integer null,
  lot_size integer null,
  year_built integer null,
  condition text null,
  remodeled_year integer null,

  api_estimate numeric null,
  comps_estimate numeric null,
  final_estimate numeric not null,
  low_estimate numeric not null,
  high_estimate numeric not null,
  confidence_score integer not null,
  confidence_label text not null,
  comparable_count integer not null default 0,
  weighted_ppsf numeric null,
  listing_trend_adjustment_pct numeric not null default 0,
  condition_adjustment_pct numeric not null default 0,
  range_spread_pct numeric not null default 0,
  tier_used text null,
  factors_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,

  actual_sale_price numeric null,
  actual_sale_date timestamptz null,
  actual_days_from_estimate integer null,
  error_amount numeric null,
  error_pct numeric null,
  inside_range boolean null,

  valuation_version text not null default 'v2',
  source text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_valuation_runs_created_at on public.valuation_runs (created_at desc);
create index if not exists idx_valuation_runs_address on public.valuation_runs (property_address);
create index if not exists idx_valuation_runs_confidence on public.valuation_runs (confidence_label, confidence_score desc);
create index if not exists idx_valuation_runs_sale_date on public.valuation_runs (actual_sale_date desc nulls last);
create index if not exists idx_valuation_runs_lead_id on public.valuation_runs (lead_id);

comment on table public.valuation_runs is 'Valuation engine runs + optional actual sale outcomes for accuracy tracking.';
