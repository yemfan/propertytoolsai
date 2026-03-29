-- Mobile Expo push token registry (user + optional agent scope).

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id bigint null references public.agents (id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'unknown'
    check (platform in ('ios', 'android', 'web', 'unknown')),
  device_id text null,
  app_version text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists idx_mobile_push_tokens_user_id
  on public.mobile_push_tokens (user_id, updated_at desc);

create index if not exists idx_mobile_push_tokens_agent_id
  on public.mobile_push_tokens (agent_id)
  where agent_id is not null;

comment on table public.mobile_push_tokens is 'Expo push tokens for LeadSmart mobile; updated via /api/mobile/push/register.';
