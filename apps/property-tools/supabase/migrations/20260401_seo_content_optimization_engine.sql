-- AI Content Optimization Engine: GSC-style metrics, DB overrides, run history, optional title A/B.

create table if not exists public.seo_page_performance (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  url_path text,
  impressions bigint not null default 0 check (impressions >= 0),
  ctr numeric(10, 8) not null default 0 check (ctr >= 0 and ctr <= 1),
  position_avg numeric(10, 4),
  period_start date,
  period_end date,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (page_key, period_start, period_end)
);

create index if not exists idx_seo_page_performance_page_key on public.seo_page_performance (page_key);
create index if not exists idx_seo_page_performance_period on public.seo_page_performance (period_end desc);

create table if not exists public.seo_content_overrides (
  page_key text primary key,
  url_path text,
  title text,
  meta_description text,
  payload_json jsonb not null default '{}'::jsonb,
  ab_variant_id text,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  last_run_id uuid
);

create table if not exists public.seo_optimization_runs (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  action text not null,
  input_snapshot jsonb,
  output_snapshot jsonb,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_optimization_runs_page_key on public.seo_optimization_runs (page_key, created_at desc);

create table if not exists public.seo_title_ab_variants (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  variant_label text not null,
  title text not null,
  impressions bigint not null default 0,
  ctr numeric(10, 8),
  position_avg numeric(10, 4),
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  unique (page_key, variant_label)
);

create index if not exists idx_seo_title_ab_page on public.seo_title_ab_variants (page_key);

comment on table public.seo_page_performance is 'Search performance snapshots (e.g. GSC): impressions, CTR, average position.';
comment on table public.seo_content_overrides is 'Published SEO overrides merged into programmatic tool/location pages.';
comment on table public.seo_optimization_runs is 'Audit log for AI optimization pipeline.';
comment on table public.seo_title_ab_variants is 'Optional A/B title variants with per-period metrics.';
