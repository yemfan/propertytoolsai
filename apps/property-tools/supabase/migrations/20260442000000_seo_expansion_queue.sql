-- Queue for auto-expanding programmatic SEO (pending → generated / failed).

create table if not exists public.seo_expansion_queue (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  city text not null,
  state text not null,
  zip text null,
  template text not null,
  max_price numeric null,
  beds integer null,
  property_type text null,
  priority integer not null default 50,
  source text not null default 'auto_expand',
  status text not null default 'pending',
  generated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seo_expansion_queue_status_priority
  on public.seo_expansion_queue (status, priority desc, created_at asc);

comment on table public.seo_expansion_queue is
  'Pending SEO page targets before batch generation into seo_pages.';

alter table public.seo_expansion_queue enable row level security;
