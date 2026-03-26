-- Registry for trained valuation (and future) ML models: artifacts metadata + activation.

create table if not exists public.ml_models (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  model_version text not null,
  status text not null default 'candidate',
  backend text not null,
  artifact_path text not null,
  schema_path text not null,
  metrics_json jsonb not null default '{}'::jsonb,
  filters_json jsonb not null default '{}'::jsonb,
  rows_used integer not null default 0,
  trained_at timestamptz not null default now(),
  trained_by uuid null,
  notes text null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ml_models_model_key on public.ml_models (model_key);
create index if not exists idx_ml_models_active on public.ml_models (model_key, is_active);
create unique index if not exists uniq_ml_model_version on public.ml_models (model_key, model_version);

comment on table public.ml_models is 'ML model registry: trained artifact paths, metrics, and optional active flag per model_key.';
