-- SERP Dominator: 5 page types per keyword cluster + ranking snapshots.

create table if not exists public.serp_dominator_campaigns (
  id uuid primary key default gen_random_uuid(),
  seed_keyword text not null,
  keyword_slug text not null,
  status text not null default 'completed' check (status in ('draft', 'completed', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists serp_dominator_campaigns_keyword_slug_key on public.serp_dominator_campaigns (keyword_slug);
create index if not exists idx_serp_dominator_campaigns_slug on public.serp_dominator_campaigns (keyword_slug);

create table if not exists public.serp_dominator_pages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.serp_dominator_campaigns (id) on delete cascade,
  page_type text not null check (page_type in ('tool', 'landing', 'blog', 'comparison', 'faq')),
  path text not null,
  title text not null,
  meta_description text not null,
  payload jsonb not null default '{}'::jsonb,
  snippet_blocks jsonb not null default '[]'::jsonb,
  internal_links jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published')),
  ai_source text not null default 'openai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, page_type)
);

create index if not exists idx_serp_dominator_pages_path on public.serp_dominator_pages (path);

create index if not exists idx_serp_dominator_pages_campaign on public.serp_dominator_pages (campaign_id);

create table if not exists public.serp_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  keyword_normalized text not null,
  page_path text not null,
  position numeric(10, 2),
  url_in_serp text,
  source text not null default 'manual' check (source in ('manual', 'gsc', 'api', 'other')),
  notes text,
  recorded_at date not null default (current_date),
  created_at timestamptz not null default now(),
  unique (keyword_normalized, page_path, recorded_at)
);

create index if not exists idx_serp_rank_snapshots_keyword on public.serp_rank_snapshots (keyword_normalized, recorded_at desc);

comment on table public.serp_dominator_campaigns is 'One campaign = one seed keyword, five page types.';
comment on table public.serp_dominator_pages is 'Tool, landing, blog, comparison, FAQ URLs for SERP coverage.';
comment on table public.serp_rank_snapshots is 'Optional ranking tracking per keyword + page path.';
