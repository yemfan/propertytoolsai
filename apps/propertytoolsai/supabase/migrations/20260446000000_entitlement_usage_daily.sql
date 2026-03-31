-- Daily entitlement counters (shared shape with LeadSmart AI billing). Requires public.profiles + set_updated_at.

create table if not exists public.entitlement_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product text not null,
  usage_date date not null default (timezone('utc', now()))::date,
  cma_reports_used integer not null default 0,
  leads_used integer not null default 0,
  contacts_used integer not null default 0,
  report_downloads_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entitlement_usage_daily_user_id
  on public.entitlement_usage_daily (user_id);

create index if not exists idx_entitlement_usage_daily_product
  on public.entitlement_usage_daily (product);

create unique index if not exists idx_entitlement_usage_daily_unique
  on public.entitlement_usage_daily (user_id, product, usage_date);

drop trigger if exists trg_entitlement_usage_daily_updated_at on public.entitlement_usage_daily;
create trigger trg_entitlement_usage_daily_updated_at
before update on public.entitlement_usage_daily
for each row execute function public.set_updated_at();

alter table public.entitlement_usage_daily enable row level security;

drop policy if exists "entitlement_usage_daily_select_own" on public.entitlement_usage_daily;
drop policy if exists "Users can read own usage" on public.entitlement_usage_daily;
create policy "Users can read own usage"
  on public.entitlement_usage_daily
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "entitlement_usage_daily_insert_own" on public.entitlement_usage_daily;
create policy "entitlement_usage_daily_insert_own"
  on public.entitlement_usage_daily
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "entitlement_usage_daily_update_own" on public.entitlement_usage_daily;
create policy "entitlement_usage_daily_update_own"
  on public.entitlement_usage_daily
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.entitlement_usage_daily is
  'UTC daily usage buckets for metered features (CMA, downloads, etc.).';
