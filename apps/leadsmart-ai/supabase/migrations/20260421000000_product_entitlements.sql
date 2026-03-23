-- LeadSmart AI: product entitlements + daily usage (leadsmart_agent)
-- Requires public.set_updated_at() from earlier migrations.

-- ---------------------------------------------------------------------------
-- product_entitlements: denormalized limits per active subscription row
-- ---------------------------------------------------------------------------
create table if not exists public.product_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product text not null,
  plan text not null,
  is_active boolean not null default true,
  cma_reports_per_day int not null default 0,
  max_leads int,
  max_contacts int,
  alerts_level text not null default 'basic',
  reports_download_level text not null default 'limited',
  team_access boolean not null default false,
  source text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_entitlements_product_nonempty check (coalesce(nullif(trim(product), ''), '') <> ''),
  constraint product_entitlements_plan_nonempty check (coalesce(nullif(trim(plan), ''), '') <> '')
);

create index if not exists idx_product_entitlements_user
  on public.product_entitlements (user_id);

create index if not exists idx_product_entitlements_product
  on public.product_entitlements (product);

create unique index if not exists uq_product_entitlements_active_user_product
  on public.product_entitlements (user_id, product)
  where is_active = true;

drop trigger if exists trg_product_entitlements_updated_at on public.product_entitlements;
create trigger trg_product_entitlements_updated_at
before update on public.product_entitlements
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- entitlement_usage_daily: daily counters (user_id → public.profiles)
-- ---------------------------------------------------------------------------
create table if not exists public.entitlement_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product text not null,
  usage_date date not null default current_date,
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
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPC: atomic daily consume for CMA or report downloads
-- ---------------------------------------------------------------------------
create or replace function public.try_consume_entitlement_daily(
  p_user_id uuid,
  p_product text,
  p_metric text,
  p_amount int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cma_limit int;
  v_reports_level text;
  v_today date := (timezone('utc', now()))::date;
  v_used int := 0;
  v_limit int;
begin
  if p_user_id is null or coalesce(nullif(trim(p_product), ''), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if p_amount is null or p_amount < 1 then
    p_amount := 1;
  end if;

  select
    e.cma_reports_per_day,
    e.reports_download_level
  into v_cma_limit, v_reports_level
  from public.product_entitlements e
  where e.user_id = p_user_id
    and e.product = p_product
    and e.is_active = true
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_active_entitlement');
  end if;

  if p_metric = 'cma_report' then
    v_limit := v_cma_limit;
    if v_limit < 0 then
      v_limit := 1000000;
    end if;
  elsif p_metric = 'report_download' then
    if lower(coalesce(v_reports_level, '')) = 'limited' then
      v_limit := 3;
    elsif lower(coalesce(v_reports_level, '')) in ('full', 'unlimited') then
      v_limit := 1000000;
    else
      v_limit := 0;
    end if;
  else
    return jsonb_build_object('ok', false, 'reason', 'unknown_metric');
  end if;

  insert into public.entitlement_usage_daily (user_id, product, usage_date)
  values (p_user_id, p_product, v_today)
  on conflict (user_id, product, usage_date) do nothing;

  select
    case p_metric
      when 'cma_report' then c.cma_reports_used
      when 'report_download' then c.report_downloads_used
      else 0
    end
  into v_used
  from public.entitlement_usage_daily c
  where c.user_id = p_user_id
    and c.product = p_product
    and c.usage_date = v_today;

  v_used := coalesce(v_used, 0);

  if v_used + p_amount > v_limit then
    return jsonb_build_object(
      'ok', false,
      'reason', 'limit_reached',
      'metric', p_metric,
      'used', v_used,
      'limit', v_limit
    );
  end if;

  if p_metric = 'cma_report' then
    update public.entitlement_usage_daily
    set cma_reports_used = cma_reports_used + p_amount,
        updated_at = now()
    where user_id = p_user_id and product = p_product and usage_date = v_today
    returning cma_reports_used into v_used;
  else
    update public.entitlement_usage_daily
    set report_downloads_used = report_downloads_used + p_amount,
        updated_at = now()
    where user_id = p_user_id and product = p_product and usage_date = v_today
    returning report_downloads_used into v_used;
  end if;

  return jsonb_build_object(
    'ok', true,
    'metric', p_metric,
    'used', v_used,
    'limit', v_limit,
    'usage_date', v_today
  );
end;
$$;

grant execute on function public.try_consume_entitlement_daily(uuid, text, text, int) to authenticated;
grant execute on function public.try_consume_entitlement_daily(uuid, text, text, int) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.product_entitlements enable row level security;
alter table public.entitlement_usage_daily enable row level security;

drop policy if exists "product_entitlements_select_own" on public.product_entitlements;
drop policy if exists "Users can read own entitlements" on public.product_entitlements;
create policy "Users can read own entitlements"
  on public.product_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "product_entitlements_insert_own" on public.product_entitlements;
create policy "product_entitlements_insert_own"
  on public.product_entitlements
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "product_entitlements_update_own" on public.product_entitlements;
create policy "product_entitlements_update_own"
  on public.product_entitlements
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

comment on table public.product_entitlements is
  'Commercial entitlements per user+product; limits denormalized from plan.';
comment on table public.entitlement_usage_daily is
  'UTC daily usage buckets for metered features (CMA, downloads, etc.).';
