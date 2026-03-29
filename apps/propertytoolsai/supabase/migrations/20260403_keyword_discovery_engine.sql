-- Keyword Discovery Engine: AI-expanded keywords, intent, scoring, clusters, dedupe.

create table if not exists public.seo_keyword_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  seeds jsonb not null default '[]'::jsonb,
  min_per_seed int not null default 50,
  candidates_total int not null default 0,
  candidates_new int not null default 0,
  candidates_updated int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_keyword_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.seo_keyword_discovery_runs (id) on delete set null,
  normalized_keyword text not null,
  display_keyword text not null,
  intent text not null check (intent in ('tool', 'informational', 'comparison')),
  score numeric(12, 4) not null default 0,
  cluster_slug text,
  source_seed text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_keyword)
);

create index if not exists idx_seo_keyword_candidates_intent on public.seo_keyword_candidates (intent);
create index if not exists idx_seo_keyword_candidates_cluster on public.seo_keyword_candidates (cluster_slug);
create index if not exists idx_seo_keyword_candidates_score on public.seo_keyword_candidates (score desc);
create index if not exists idx_seo_keyword_candidates_run on public.seo_keyword_candidates (run_id);

comment on table public.seo_keyword_discovery_runs is 'Audit log for keyword discovery batches.';
comment on table public.seo_keyword_candidates is 'Deduped keyword universe with intent, score, and cluster assignment.';
