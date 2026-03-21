-- Property Data Warehouse schema for LeadSmart AI
-- Run in Supabase SQL editor.

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- 1) Master property record (1 per address)
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  address text not null unique,
  city text,
  state text,
  zip_code text,
  lat double precision,
  lng double precision,
  property_type text,
  beds int,
  baths double precision,
  sqft int,
  lot_size int,
  year_built int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_properties_address on public.properties (address);
create index if not exists idx_properties_zip on public.properties (zip_code);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_properties_updated_at on public.properties;
create trigger trg_properties_updated_at
before update on public.properties
for each row
execute procedure public.set_updated_at();

-- 2) Historical snapshots
create table if not exists public.property_snapshots (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  estimated_value numeric,
  rent_estimate numeric,
  price_per_sqft numeric,
  listing_status text,
  data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_property_snapshots_property_id_created_at
  on public.property_snapshots(property_id, created_at desc);

-- 3) Comparable properties
create table if not exists public.property_comps (
  id uuid primary key default gen_random_uuid(),
  subject_property_id uuid not null references public.properties(id) on delete cascade,
  comp_property_id uuid not null references public.properties(id) on delete cascade,
  distance_miles double precision,
  sold_price numeric,
  sold_date date,
  similarity_score double precision,
  created_at timestamptz not null default now(),
  unique(subject_property_id, comp_property_id)
);

create index if not exists idx_property_comps_subject on public.property_comps(subject_property_id);
create index if not exists idx_property_comps_comp on public.property_comps(comp_property_id);

-- Existing fast cache table (if not already created)
create table if not exists public.properties_cache (
  id uuid primary key default gen_random_uuid(),
  address text not null unique,
  city text,
  state text,
  zip_code text,
  data jsonb,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_properties_address on public.properties_cache(address);

-- Monetization prep: plan_type on agents
alter table if exists public.agents
  add column if not exists plan_type text not null default 'free';

