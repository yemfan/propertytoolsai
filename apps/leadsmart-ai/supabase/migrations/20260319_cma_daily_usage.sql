-- Daily CMA usage limits (anonymous + logged-in + agents)

create table if not exists public.cma_daily_usage (
  subject_key text primary key,
  user_id uuid,
  role text not null default 'anonymous', -- anonymous | user | agent
  cma_usage_count int not null default 0,
  last_reset_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cma_daily_usage_user_id
  on public.cma_daily_usage(user_id);

create index if not exists idx_cma_daily_usage_role
  on public.cma_daily_usage(role);

-- Keep user_profiles in sync with daily counters for future analytics/UI.
alter table if exists public.user_profiles
  add column if not exists cma_usage_count int not null default 0,
  add column if not exists last_reset_date date;

