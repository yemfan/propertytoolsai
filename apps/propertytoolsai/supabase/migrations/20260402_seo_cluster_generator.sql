-- Auto Cluster Generator: topic × location SEO pages (1,000+ scale).

create table if not exists public.seo_cluster_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  keywords text[] not null default '{}',
  related_slugs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_cluster_pages (
  id uuid primary key default gen_random_uuid(),
  topic_slug text not null references public.seo_cluster_topics (slug) on delete cascade,
  location_slug text not null,
  city text not null,
  state text not null,
  primary_keyword text,
  title text not null,
  meta_description text not null,
  payload jsonb not null default '{}'::jsonb,
  internal_links jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published')),
  ai_source text not null default 'openai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_slug, location_slug)
);

create index if not exists idx_seo_cluster_pages_location on public.seo_cluster_pages (location_slug);
create index if not exists idx_seo_cluster_pages_status on public.seo_cluster_pages (status);

create table if not exists public.seo_cluster_generation_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'batch',
  input_summary jsonb,
  pages_created int not null default 0,
  pages_failed int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

comment on table public.seo_cluster_topics is 'Content cluster definitions (slug, keywords, related topics for internal links).';
comment on table public.seo_cluster_pages is 'Published programmatic guide pages: topic × location.';
comment on table public.seo_cluster_generation_runs is 'Audit log for daily / batch cluster generation.';
