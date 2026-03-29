-- Align entitlement_usage_daily with public.profiles(id) + indexes (idempotent for DBs that applied an older 20260421 shape).

-- 1) Re-point FK from auth.users → profiles (same uuid domain as auth.users)
alter table if exists public.entitlement_usage_daily
  drop constraint if exists entitlement_usage_daily_user_id_fkey;

alter table if exists public.entitlement_usage_daily
  add constraint entitlement_usage_daily_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- 2) usage_date default
alter table if exists public.entitlement_usage_daily
  alter column usage_date set default current_date;

-- 3) Unique: drop legacy constraint name if present, ensure named unique index
alter table if exists public.entitlement_usage_daily
  drop constraint if exists entitlement_usage_daily_unique_day;

drop index if exists public.idx_entitlement_usage_daily_user_product_date;

create unique index if not exists idx_entitlement_usage_daily_unique
  on public.entitlement_usage_daily (user_id, product, usage_date);

create index if not exists idx_entitlement_usage_daily_user_id
  on public.entitlement_usage_daily (user_id);

create index if not exists idx_entitlement_usage_daily_product
  on public.entitlement_usage_daily (product);
