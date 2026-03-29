-- Optional Stripe subscription id + metadata for MRR time-series reconstruction and tooling.

alter table public.subscription_events
  add column if not exists stripe_subscription_id text null;

alter table public.subscription_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_subscription_events_stripe_created
  on public.subscription_events (stripe_subscription_id, created_at desc);

comment on column public.subscription_events.stripe_subscription_id is
  'Stripe subscription id when the event relates to a specific subscription row.';
