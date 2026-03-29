-- Product / funnel analytics (lead_scored, price_assigned, etc.) — used by lib/leadScorePipeline.ts
-- Mirrors apps/propertytoolsai/supabase/migrations/20260315_product_events_and_lead_intent.sql (events table only).

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

comment on table public.events is 'Product / funnel analytics (tool_used, lead_submitted, lead_scored, etc.)';

alter table public.events enable row level security;
