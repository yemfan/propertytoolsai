-- Dedicated funnel leads for /home-value (name, email, phone, snapshot).
-- Superseded by 20260422000000_home_value_leads_flat.sql (flat columns).
-- Inserts happen from API routes using the service role (bypasses RLS).

create extension if not exists pgcrypto;

create table if not exists public.home_value_leads (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid null references auth.users (id) on delete set null,

  name text not null,
  email text not null,
  phone text null,

  full_address text not null,
  property_details jsonb not null default '{}'::jsonb,
  estimate_snapshot jsonb not null default '{}'::jsonb,

  source text not null default 'home_value_funnel_v1',

  created_at timestamptz not null default now()
);

create index if not exists idx_home_value_leads_session_id
  on public.home_value_leads (session_id);

create index if not exists idx_home_value_leads_email
  on public.home_value_leads (lower(email));

create index if not exists idx_home_value_leads_created_at
  on public.home_value_leads (created_at desc);

comment on table public.home_value_leads is
  'Marketing funnel lead rows from the /home-value estimate flow (contact + estimate snapshot).';

alter table public.home_value_leads enable row level security;

-- No anon policies: only service role / server-side inserts.
