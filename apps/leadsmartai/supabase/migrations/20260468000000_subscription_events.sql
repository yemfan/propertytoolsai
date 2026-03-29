-- Append-only subscription lifecycle / billing events (Stripe sync, upgrades, etc.).

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  plan text,
  amount numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_events_user_created
  on public.subscription_events (user_id, created_at desc);

create index if not exists idx_subscription_events_type_created
  on public.subscription_events (event_type, created_at desc);

comment on table public.subscription_events is
  'Audit trail for subscription changes and charges; optional user when known.';
