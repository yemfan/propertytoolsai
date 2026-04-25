-- Sales Model System — agent_profiles table.
--
-- Stores each agent's chosen sales-model identity (Influencer, Closer,
-- Advisor, Custom). The selection drives the dashboard's identity
-- block, daily action plan, model-specific tools, script-generator
-- tone, and pipeline stages — see lib/sales-models.ts for the
-- canonical config the values map to.
--
-- One row per auth user; `user_id` is the natural key (not agent_id —
-- agents may share a single auth user during dev). Upserts on user_id
-- so flipping models is a no-churn operation.
--
-- The CHECK constraint mirrors the SalesModelId TypeScript union so
-- a bad client write fails at the database, not just at the typescript
-- compile step.

create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sales_model text
    check (sales_model in ('influencer', 'closer', 'advisor', 'custom')),
  sales_model_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce one profile per user. We upsert on user_id, so this also
-- protects the upsert from accidentally inserting duplicates if a
-- racing request lands first.
create unique index if not exists agent_profiles_user_id_key
  on public.agent_profiles(user_id);

-- Auto-touch updated_at on every row update so we never have to
-- remember to set it from the application layer.
create or replace function public.set_agent_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_profiles_set_updated_at on public.agent_profiles;
create trigger agent_profiles_set_updated_at
  before update on public.agent_profiles
  for each row execute procedure public.set_agent_profiles_updated_at();

-- RLS: each agent reads + writes their own row only. The service-role
-- helpers in lib/sales-model-server.ts bypass RLS (they're called from
-- API routes that have already authenticated the user), but we still
-- want the policy in place for any future client-direct queries.
alter table public.agent_profiles enable row level security;

drop policy if exists "agent_profiles_select_own" on public.agent_profiles;
create policy "agent_profiles_select_own"
  on public.agent_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "agent_profiles_insert_own" on public.agent_profiles;
create policy "agent_profiles_insert_own"
  on public.agent_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "agent_profiles_update_own" on public.agent_profiles;
create policy "agent_profiles_update_own"
  on public.agent_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
