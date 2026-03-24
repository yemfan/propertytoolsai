-- Flat columns for home value funnel leads (replaces jsonb snapshot shape from 20260421000000).
-- Safe for DBs that already ran the older home_value_leads migration.

create extension if not exists pgcrypto;

drop table if exists public.home_value_leads cascade;

create table public.home_value_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  phone text,
  address text not null,
  property_type text,
  beds numeric,
  baths numeric,
  living_area_sqft numeric,
  lot_size_sqft numeric,
  year_built numeric,
  condition text,
  estimate_value numeric,
  estimate_low numeric,
  estimate_high numeric,
  confidence_score numeric,
  source text default 'home_value_funnel',
  created_at timestamptz not null default now()
);

create index if not exists idx_home_value_leads_email
  on public.home_value_leads (lower(email));

create index if not exists idx_home_value_leads_created_at
  on public.home_value_leads (created_at desc);

comment on table public.home_value_leads is
  'Home value funnel leads (flat columns).';

alter table public.home_value_leads enable row level security;
