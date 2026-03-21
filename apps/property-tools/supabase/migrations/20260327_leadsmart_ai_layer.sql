-- PropertyTools AI: cache, usage tracking, rate-limit data

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  prompt_hash text not null,
  response text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_ai_cache_prompt_hash on public.ai_cache (prompt_hash);
create index if not exists idx_ai_cache_created_at on public.ai_cache (created_at desc);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  tokens_used int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_created on public.ai_usage(user_id, created_at desc);
create index if not exists idx_ai_usage_tool_created on public.ai_usage(tool, created_at desc);
