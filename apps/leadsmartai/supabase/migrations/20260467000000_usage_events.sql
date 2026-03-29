-- Generic usage / analytics events (append-only).
-- `user_id` nullable for system or pre-auth events.

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_user_created
  on public.usage_events (user_id, created_at desc);

create index if not exists idx_usage_events_type_created
  on public.usage_events (event_type, created_at desc);

comment on table public.usage_events is
  'Append-only usage or product events; optional link to profiles when user is known.';
