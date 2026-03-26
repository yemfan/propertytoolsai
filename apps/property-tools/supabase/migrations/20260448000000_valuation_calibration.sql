-- Scenario-based valuation weight calibration (profiles + history).

create table if not exists public.valuation_calibration_profiles (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null unique,
  comps_weight numeric not null,
  api_weight numeric not null,
  trend_weight numeric not null,
  tax_weight numeric not null,
  condition_cap_pct numeric not null default 0.10,
  confidence_penalty_pct numeric not null default 0,
  sample_size integer not null default 0,
  median_error_pct numeric not null default 0,
  inside_range_pct numeric not null default 0,
  version integer not null default 1,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.valuation_calibration_history (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  comps_weight numeric not null,
  api_weight numeric not null,
  trend_weight numeric not null,
  tax_weight numeric not null,
  condition_cap_pct numeric not null default 0.10,
  confidence_penalty_pct numeric not null default 0,
  sample_size integer not null default 0,
  median_error_pct numeric not null default 0,
  inside_range_pct numeric not null default 0,
  version integer not null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_valuation_calibration_history_scenario
  on public.valuation_calibration_history (scenario_key, created_at desc);

comment on table public.valuation_calibration_profiles is 'Active per-scenario valuation blend weights and caps.';
comment on table public.valuation_calibration_history is 'Append-only history of calibration updates.';
