-- Home value sessions, tool behavior events, market cache, and CRM lead extensions.
--
-- Notes:
-- - `public.leads` already exists in this project with `id bigint` (CRM). We extend it
--   with LeadSmart / home-value columns instead of replacing the table (which would
--   break FKs like leadsmart_runs, communications, etc.).
-- - Some requested indexes (`idx_leads_email`, `idx_leads_city`) may already exist;
--   we use IF NOT EXISTS.
-- - Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper (shared with other tables)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- home_value_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.home_value_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid null references auth.users (id) on delete set null,
  full_address text not null,
  street text null,
  city text not null,
  state text not null,
  zip text not null,
  lat numeric null,
  lng numeric null,

  property_type text null,
  beds numeric null,
  baths numeric null,
  sqft integer null,
  year_built integer null,
  lot_size integer null,
  condition text null,
  renovated_recently boolean null,

  estimate_value numeric null,
  estimate_low numeric null,
  estimate_high numeric null,
  confidence text null,
  confidence_score integer null,
  likely_intent text null,

  source text null default 'propertytoolsai_home_value',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_home_value_sessions_session_id
  on public.home_value_sessions (session_id);

drop trigger if exists trg_home_value_sessions_updated_at on public.home_value_sessions;
create trigger trg_home_value_sessions_updated_at
before update on public.home_value_sessions
for each row
execute function public.set_updated_at();

alter table public.home_value_sessions enable row level security;

comment on table public.home_value_sessions is
  'Home value estimate funnel rows (pre/post lead capture) keyed by client session_id.';

-- ---------------------------------------------------------------------------
-- tool_events
-- ---------------------------------------------------------------------------
create table if not exists public.tool_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid null references auth.users (id) on delete set null,
  tool_name text not null,
  event_name text not null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tool_events_session_id
  on public.tool_events (session_id);

create index if not exists idx_tool_events_tool_event
  on public.tool_events (tool_name, event_name);

alter table public.tool_events enable row level security;

comment on table public.tool_events is
  'Fine-grained tool analytics for scoring and personalization.';

-- ---------------------------------------------------------------------------
-- market_snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  zip text null,
  property_type text null,

  median_ppsf numeric not null,
  median_price numeric null,
  yoy_trend_pct numeric null,
  avg_days_on_market integer null,
  comp_count integer null,

  snapshot_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_market_snapshots_city_zip
  on public.market_snapshots (city, zip);

alter table public.market_snapshots enable row level security;

comment on table public.market_snapshots is
  'Cached local market inputs for the estimate engine.';

-- ---------------------------------------------------------------------------
-- leads (extend existing CRM table)
-- ---------------------------------------------------------------------------
alter table if exists public.leads
  add column if not exists session_id text,
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists full_address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists estimated_value numeric,
  add column if not exists estimate_low numeric,
  add column if not exists estimate_high numeric,
  add column if not exists confidence text,
  add column if not exists confidence_score integer,
  add column if not exists likely_intent text,
  add column if not exists status text not null default 'new',
  add column if not exists assigned_agent_id uuid,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_leads_email
  on public.leads (email);

create index if not exists idx_leads_city
  on public.leads (city);

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

comment on column public.leads.full_address is
  'Normalized full street address (LeadSmart / home value); may mirror property_address.';
comment on column public.leads.estimated_value is
  'LeadSmart home value point estimate (may mirror property_value / estimated_home_value).';
comment on column public.leads.status is
  'LeadSmart pipeline status; existing CRM may also use lead_status.';
comment on column public.leads.assigned_agent_id is
  'Optional agent assignment for LeadSmart; may mirror agent_id.';
