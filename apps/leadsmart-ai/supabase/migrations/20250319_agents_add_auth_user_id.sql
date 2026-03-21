-- Fix: agents.user_id is BIGINT in older schemas.
-- We store Supabase Auth UUIDs in a dedicated column instead.

alter table if exists public.agents
  add column if not exists auth_user_id uuid;

create index if not exists idx_agents_auth_user_id on public.agents(auth_user_id);
create unique index if not exists idx_agents_auth_user_id_unique
  on public.agents(auth_user_id)
  where auth_user_id is not null;

