-- City-level market data engine for programmatic SEO pages

create table if not exists public.city_market_data (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text not null,
  median_price numeric(12,2) not null default 0,
  price_per_sqft numeric(10,2) not null default 0,
  trend text not null default 'stable',
  days_on_market integer not null default 0,
  inventory integer not null default 0,
  source text not null default 'fallback',
  raw_payload jsonb not null default '{}'::jsonb,
  ai_market_summary text,
  ai_seller_recommendation text,
  last_fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint city_market_data_trend_check check (trend in ('up', 'down', 'stable'))
);

create unique index if not exists uq_city_market_data_city_state
  on public.city_market_data (city, state);

create index if not exists idx_city_market_data_expires_at
  on public.city_market_data (expires_at);

create index if not exists idx_city_market_data_last_fetched
  on public.city_market_data (last_fetched_at desc);
