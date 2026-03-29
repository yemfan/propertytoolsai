-- Stripe + subscription fields on agents
-- Run in Supabase SQL editor.

alter table if exists public.agents
  add column if not exists plan_type text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- Helpful indexes for webhook lookups
create index if not exists idx_agents_user_id on public.agents(user_id);
create index if not exists idx_agents_stripe_customer_id on public.agents(stripe_customer_id);
create index if not exists idx_agents_stripe_subscription_id on public.agents(stripe_subscription_id);

