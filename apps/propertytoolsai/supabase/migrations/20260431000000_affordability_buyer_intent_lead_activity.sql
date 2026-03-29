alter table if exists public.affordability_sessions
  add column if not exists buyer_intent_json jsonb null;

create table if not exists public.lead_activity_events (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  event_type text not null,
  title text not null,
  description text null,
  source text null,
  actor_type text null,
  actor_name text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_activity_events_lead_id_created_at
  on public.lead_activity_events (lead_id, created_at desc);

comment on table public.lead_activity_events is
  'CRM-style events for leads (affordability, lender match, etc.).';
