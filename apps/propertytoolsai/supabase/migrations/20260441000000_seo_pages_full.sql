-- Full programmatic SEO storage (replaces minimal seo_pages from 20260440000000 if present).
drop table if exists public.seo_pages cascade;

create table public.seo_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  template text not null,
  city text not null,
  state text not null,
  zip text null,
  max_price numeric null,
  beds integer null,
  property_type text null,
  title text not null,
  meta_title text not null,
  meta_description text not null,
  h1 text not null,
  intro text not null,
  stats_json jsonb not null default '[]'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  internal_links_json jsonb not null default '[]'::jsonb,
  listings_query_json jsonb not null default '{}'::jsonb,
  calculator_cta_json jsonb not null default '{}'::jsonb,
  page_json jsonb not null default '{}'::jsonb,
  status text not null default 'published',
  generation_version integer not null default 1,
  last_generated_at timestamptz not null default now(),
  last_indexed_at timestamptz null,
  last_visited_at timestamptz null,
  visit_count integer not null default 0,
  lead_count integer not null default 0,
  revenue_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seo_pages_city on public.seo_pages (city);
create index if not exists idx_seo_pages_template on public.seo_pages (template);
create index if not exists idx_seo_pages_status on public.seo_pages (status);
create index if not exists idx_seo_pages_updated_at on public.seo_pages (updated_at desc);
create index if not exists idx_seo_pages_last_generated_at on public.seo_pages (last_generated_at asc);

comment on table public.seo_pages is 'Persisted programmatic SEO landing pages (content + metrics).';

alter table public.seo_pages enable row level security;
