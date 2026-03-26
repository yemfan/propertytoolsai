-- Valuation ML training: export audit log + denormalized view of labeled runs (actual sale known).

create table if not exists public.valuation_training_exports (
  id uuid primary key default gen_random_uuid(),
  export_name text not null,
  row_count integer not null default 0,
  filters_json jsonb not null default '{}'::jsonb,
  schema_version text not null default 'v1',
  file_format text not null default 'csv',
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_valuation_training_exports_created_at
  on public.valuation_training_exports (created_at desc);

comment on table public.valuation_training_exports is 'Audit log of admin valuation training dataset exports (CSV/JSON).';

-- Ensure lead columns referenced by the view exist (idempotent).
-- Remote DBs may not have run earlier migrations that add attribution / SEO fields.
alter table if exists public.leads add column if not exists source text null;
alter table if exists public.leads add column if not exists intent text null;
alter table if exists public.leads add column if not exists price numeric(12, 2) null;
alter table if exists public.leads add column if not exists lead_score integer not null default 0;
alter table if exists public.leads add column if not exists lead_temperature text not null default 'cold';
alter table if exists public.leads add column if not exists engagement_score integer not null default 0;
alter table if exists public.leads add column if not exists source_session_id text null;
alter table if exists public.leads add column if not exists landing_page text null;
alter table if exists public.leads add column if not exists seo_slug text null;

-- Labeled rows only: requires actual_sale_price for supervised training labels.
create or replace view public.valuation_training_rows as
select
  vr.id,
  vr.lead_id,
  vr.property_address,
  vr.city,
  vr.state,
  vr.zip,
  vr.property_type,
  vr.beds,
  vr.baths,
  vr.sqft,
  vr.lot_size,
  vr.year_built,
  vr.condition,
  vr.remodeled_year,
  vr.api_estimate,
  vr.comps_estimate,
  vr.tax_anchor_estimate,
  vr.final_estimate,
  vr.low_estimate,
  vr.high_estimate,
  vr.confidence_score,
  vr.confidence_label,
  vr.comparable_count,
  vr.weighted_ppsf,
  vr.listing_trend_adjustment_pct,
  vr.condition_adjustment_pct,
  vr.range_spread_pct,
  vr.tier_used,
  vr.valuation_version,
  vr.actual_sale_price,
  vr.actual_sale_date,
  vr.actual_days_from_estimate,
  vr.error_amount,
  vr.error_pct,
  vr.inside_range,
  vr.created_at,
  l.source as lead_source,
  l.intent as lead_intent,
  l.price as lead_price,
  l.lead_score,
  l.lead_temperature,
  l.engagement_score,
  l.source_session_id,
  l.landing_page,
  l.seo_slug
from public.valuation_runs vr
left join public.leads l on l.id = vr.lead_id
where vr.actual_sale_price is not null;

comment on view public.valuation_training_rows is 'Training-ready valuation rows joined to lead attribution; only rows with known sale price.';
