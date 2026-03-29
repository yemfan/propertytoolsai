-- AI-driven lead pricing engine

create table if not exists public.lead_pricing_weights (
  id uuid primary key default gen_random_uuid(),
  model_version text not null default 'v1',
  behavior_weight numeric(6,4) not null default 0.25,
  engagement_weight numeric(6,4) not null default 0.25,
  profile_weight numeric(6,4) not null default 0.25,
  market_weight numeric(6,4) not null default 0.25,
  base_price numeric(10,2) not null default 10,
  updated_from_learning boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_pricing_weights_model_created
  on public.lead_pricing_weights(model_version, created_at desc);

create table if not exists public.lead_pricing_predictions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid null references public.opportunities(id) on delete set null,
  lead_id bigint null references public.leads(id) on delete set null,
  property_address text,
  city text,
  state text,
  model_version text not null default 'v1',
  behavior_score numeric(8,2) not null default 0,
  engagement_score numeric(8,2) not null default 0,
  profile_score numeric(8,2) not null default 0,
  market_score numeric(8,2) not null default 0,
  lead_score numeric(8,2) not null default 0,
  score_multiplier numeric(8,4) not null default 1,
  demand_multiplier numeric(8,4) not null default 1,
  price_credits int not null default 0,
  commission_value numeric(12,2) not null default 0,
  close_probability numeric(8,4) not null default 0,
  expected_revenue numeric(12,2) not null default 0,
  explanation text not null default '',
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_pricing_predictions_created
  on public.lead_pricing_predictions(created_at desc);
create index if not exists idx_lead_pricing_predictions_opportunity
  on public.lead_pricing_predictions(opportunity_id, created_at desc);
create index if not exists idx_lead_pricing_predictions_lead
  on public.lead_pricing_predictions(lead_id, created_at desc);

insert into public.lead_pricing_weights (
  model_version,
  behavior_weight,
  engagement_weight,
  profile_weight,
  market_weight,
  base_price,
  updated_from_learning,
  notes
)
select
  'v1',
  0.25,
  0.25,
  0.25,
  0.25,
  10,
  false,
  'Initial equal-weight baseline.'
where not exists (
  select 1 from public.lead_pricing_weights where model_version = 'v1'
);
