-- Competitor reverse-engineering: crawl sitemap → scrape → AI keywords → gap opportunities.

create table if not exists public.seo_competitor_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  config jsonb default '{}'::jsonb,
  pages_crawled int not null default 0,
  keywords_extracted int not null default 0,
  opportunities_created int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_competitor_pages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.seo_competitor_analysis_runs (id) on delete cascade,
  url text not null,
  title text,
  headings jsonb not null default '[]'::jsonb,
  text_excerpt text,
  text_chars int not null default 0,
  http_status int,
  fetch_error text,
  created_at timestamptz not null default now(),
  unique (run_id, url)
);

create index if not exists idx_seo_competitor_pages_run on public.seo_competitor_pages (run_id);

create table if not exists public.seo_competitor_keywords (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.seo_competitor_analysis_runs (id) on delete cascade,
  page_id uuid references public.seo_competitor_pages (id) on delete set null,
  normalized_keyword text not null,
  display_keyword text not null,
  intent text check (intent is null or intent in ('tool', 'informational', 'comparison')),
  extraction_score numeric(12, 4),
  source_page_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_competitor_keywords_run on public.seo_competitor_keywords (run_id);
create index if not exists idx_seo_competitor_keywords_norm on public.seo_competitor_keywords (normalized_keyword);

create table if not exists public.seo_keyword_opportunities (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.seo_competitor_analysis_runs (id) on delete cascade,
  normalized_keyword text not null,
  display_keyword text not null,
  opportunity_score numeric(12, 4) not null,
  gap_type text not null default 'missing_in_catalog',
  gap_detail text,
  cluster_slug text,
  suggested_guide_path text,
  competitor_refs jsonb not null default '[]'::jsonb,
  rank int not null default 0,
  created_at timestamptz not null default now(),
  unique (run_id, normalized_keyword)
);

create index if not exists idx_seo_keyword_opportunities_run_rank on public.seo_keyword_opportunities (run_id, rank);

comment on table public.seo_competitor_analysis_runs is 'Competitor crawl + extraction batch.';
comment on table public.seo_competitor_pages is 'Scraped page snapshots (title, headings, excerpt).';
comment on table public.seo_competitor_keywords is 'AI-extracted keywords per competitor page.';
comment on table public.seo_keyword_opportunities is 'Ranked gaps vs our keyword catalog for page generation.';
