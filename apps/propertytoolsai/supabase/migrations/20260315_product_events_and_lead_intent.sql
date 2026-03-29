-- Product analytics events + optional lead intent (tool capture funnel)
-- Safe to re-run.

-- Intent for tool-sourced leads (buy | sell | refinance | unknown)
alter table if exists public.leads
  add column if not exists intent text;

create index if not exists idx_leads_intent on public.leads(intent);

-- Anonymous + authenticated product analytics (separate from lead_events engagement rows)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_event_type_created_at
  on public.events (event_type, created_at desc);

create index if not exists idx_events_user_id_created_at
  on public.events (user_id, created_at desc);

comment on table public.events is 'Product / funnel analytics (tool_used, lead_submitted, etc.)';

alter table public.events enable row level security;

-- No public policies: inserts go through Next.js API routes using the service role key.
