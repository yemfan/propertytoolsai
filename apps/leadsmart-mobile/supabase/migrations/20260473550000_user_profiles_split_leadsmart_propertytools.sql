-- Split identity vs app-specific data:
--   public.user_profiles       — shared: contact + auth linkage (email, invited_*, avatar, phone, name)
--   public.leadsmart_users     — LeadSmart: RBAC role, plans, tokens, trials, Stripe (agent), usage, CRM ids
--   public.propertytools_users — PropertyTools: tier basic | premium + consumer Stripe snapshot (no RBAC role)
--
-- Deprecates public.profiles: merged into user_profiles; FKs repointed to user_profiles(user_id).
-- Updates public.consume_tokens + public.increment_usage to use leadsmart_users.

-- ---------------------------------------------------------------------------
-- 1) Shared columns on user_profiles (merge target for profiles)
-- ---------------------------------------------------------------------------
alter table if exists public.user_profiles
  add column if not exists email text,
  add column if not exists invited_by uuid references auth.users (id) on delete set null,
  add column if not exists invited_at timestamptz;

create index if not exists idx_user_profiles_email on public.user_profiles (email);

-- ---------------------------------------------------------------------------
-- 2) App-specific tables
-- ---------------------------------------------------------------------------
create table if not exists public.leadsmart_users (
  user_id uuid primary key references public.user_profiles (user_id) on delete cascade,
  role text not null default 'user',
  license_number text,
  brokerage text,
  plan text not null default 'free',
  tokens_remaining int not null default 10,
  tokens_reset_date timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  trial_used boolean not null default false,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  oauth_onboarding_completed boolean not null default false,
  subscription_current_period_start timestamptz,
  subscription_current_period_end timestamptz,
  subscription_cancel_at_period_end boolean not null default false,
  estimator_usage_count int not null default 0,
  cma_usage_count int not null default 0,
  usage_reset_date timestamptz,
  last_reset_date date,
  agent_id text,
  broker_id text,
  support_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leadsmart_users_role on public.leadsmart_users (role);
create index if not exists idx_leadsmart_users_stripe_customer on public.leadsmart_users (stripe_customer_id);
create index if not exists idx_leadsmart_users_stripe_sub on public.leadsmart_users (stripe_subscription_id);

comment on table public.leadsmart_users is
  'LeadSmart-only profile: RBAC role, agent/broker fields, token/plan usage, CRM linkage ids.';

create table if not exists public.propertytools_users (
  user_id uuid primary key references public.user_profiles (user_id) on delete cascade,
  tier text not null default 'basic' check (tier in ('basic', 'premium')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_current_period_start timestamptz,
  subscription_current_period_end timestamptz,
  subscription_cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_propertytools_users_tier on public.propertytools_users (tier);
comment on table public.propertytools_users is
  'PropertyTools consumer subscription: basic (free) vs premium; no RBAC role here.';

-- ---------------------------------------------------------------------------
-- 3) Merge public.profiles → user_profiles (run before moving columns off user_profiles)
-- ---------------------------------------------------------------------------
do $merge$
begin
  if to_regclass('public.profiles') is null then
    raise notice '20260473550000: public.profiles missing — skip merge from profiles.';
  else
    insert into public.user_profiles (user_id, full_name, email, invited_by, invited_at)
    select
      p.id,
      p.full_name,
      p.email,
      p.invited_by,
      p.invited_at
    from public.profiles p
    on conflict (user_id) do update
    set
      full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
      email = coalesce(excluded.email, public.user_profiles.email),
      invited_by = coalesce(excluded.invited_by, public.user_profiles.invited_by),
      invited_at = coalesce(excluded.invited_at, public.user_profiles.invited_at);
  end if;
end $merge$;

-- ---------------------------------------------------------------------------
-- 3b) Legacy billing/RBAC columns on user_profiles (older DBs may never have had these)
--     Required before backfill SELECT — add missing columns only.
-- ---------------------------------------------------------------------------
alter table if exists public.user_profiles
  add column if not exists role text,
  add column if not exists license_number text,
  add column if not exists brokerage text,
  add column if not exists plan text default 'free',
  add column if not exists tokens_remaining int default 10,
  add column if not exists tokens_reset_date timestamptz default (date_trunc('month', now()) + interval '1 month'),
  add column if not exists trial_used boolean default false,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists oauth_onboarding_completed boolean default false,
  add column if not exists subscription_current_period_start timestamptz,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean default false,
  add column if not exists estimator_usage_count int default 0,
  add column if not exists cma_usage_count int default 0,
  add column if not exists usage_reset_date timestamptz,
  add column if not exists last_reset_date date;

-- ---------------------------------------------------------------------------
-- 4) Backfill leadsmart_users from user_profiles (while legacy columns still exist)
-- ---------------------------------------------------------------------------
insert into public.leadsmart_users (
  user_id,
  role,
  license_number,
  brokerage,
  plan,
  tokens_remaining,
  tokens_reset_date,
  trial_used,
  trial_started_at,
  trial_ends_at,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  oauth_onboarding_completed,
  subscription_current_period_start,
  subscription_current_period_end,
  subscription_cancel_at_period_end,
  estimator_usage_count,
  cma_usage_count,
  usage_reset_date,
  last_reset_date
)
select
  up.user_id,
  up.role,
  up.license_number,
  up.brokerage,
  up.plan,
  up.tokens_remaining,
  up.tokens_reset_date,
  up.trial_used,
  up.trial_started_at,
  up.trial_ends_at,
  up.stripe_customer_id,
  up.stripe_subscription_id,
  up.subscription_status,
  coalesce(up.oauth_onboarding_completed, false),
  up.subscription_current_period_start,
  up.subscription_current_period_end,
  up.subscription_cancel_at_period_end,
  up.estimator_usage_count,
  up.cma_usage_count,
  up.usage_reset_date,
  up.last_reset_date
from public.user_profiles up
on conflict (user_id) do nothing;

do $crm$
begin
  if to_regclass('public.profiles') is not null then
    update public.leadsmart_users ls
    set
      agent_id = coalesce(ls.agent_id, p.agent_id::text),
      broker_id = coalesce(ls.broker_id, p.broker_id::text),
      support_id = coalesce(ls.support_id, p.support_id::text)
    from public.profiles p
    where p.id = ls.user_id;
  end if;
end $crm$;

-- ---------------------------------------------------------------------------
-- 5) PropertyTools tier (uses legacy user_profiles columns; refined via billing_subscriptions)
-- ---------------------------------------------------------------------------
insert into public.propertytools_users (user_id, tier)
select up.user_id,
  case
    when lower(coalesce(up.role, '')) = 'user'
      and (
        up.plan in ('premium', 'pro')
        or lower(coalesce(up.subscription_status, '')) in ('active', 'trialing')
      )
      then 'premium'
    else 'basic'
  end
from public.user_profiles up
on conflict (user_id) do nothing;

do $tier$
begin
  if to_regclass('public.profiles') is not null and to_regclass('public.billing_subscriptions') is not null then
    update public.propertytools_users pt
    set tier = 'premium'
    from public.profiles p
    where p.id = pt.user_id
      and lower(coalesce(p.role, '')) = 'consumer'
      and exists (
        select 1
        from public.billing_subscriptions bs
        where bs.user_id = p.id
          and lower(coalesce(bs.status, '')) in ('active', 'trialing', 'past_due')
      );
  end if;
end $tier$;

insert into public.propertytools_users (user_id, tier)
select ls.user_id, 'basic'
from public.leadsmart_users ls
where not exists (select 1 from public.propertytools_users pt where pt.user_id = ls.user_id)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 6) Repoint FKs: public.profiles(id) → public.user_profiles(user_id)
-- ---------------------------------------------------------------------------
do $dropprof$
declare
  r record;
begin
  if to_regclass('public.profiles') is null then
    raise notice '20260473550000: public.profiles missing — skip FK drop/repoint.';
  else
    for r in
      select c.conname, c.conrelid::regclass as tbl
      from pg_constraint c
      where c.confrelid = 'public.profiles'::regclass
        and c.contype = 'f'
    loop
      execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    end loop;
  end if;
end $dropprof$;

create or replace function public.__pt_add_fk_user_profiles(
  p_table text,
  p_constraint text,
  p_col text,
  p_on_delete text
)
returns void
language plpgsql
as $$
declare
  v_action text := case lower(p_on_delete)
    when 'cascade' then 'on delete cascade'
    when 'set null' then 'on delete set null'
    else 'on delete cascade'
  end;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = p_table
  ) then
    return;
  end if;
  execute format(
    'alter table public.%I add constraint %I foreign key (%I) references public.user_profiles(user_id) %s',
    p_table,
    p_constraint,
    p_col,
    v_action
  );
exception
  when duplicate_object then null;
  when undefined_table then null;
end;
$$;

select public.__pt_add_fk_user_profiles('subscriptions', 'subscriptions_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('billing_subscriptions', 'billing_subscriptions_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('leadsmart_funnel_state', 'leadsmart_funnel_state_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('leadsmart_funnel_events', 'leadsmart_funnel_events_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('entitlement_usage_daily', 'entitlement_usage_daily_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('usage_events', 'usage_events_user_id_fkey', 'user_id', 'set null');
select public.__pt_add_fk_user_profiles('subscription_events', 'subscription_events_user_id_fkey', 'user_id', 'set null');
select public.__pt_add_fk_user_profiles('product_entitlements', 'product_entitlements_user_id_fkey', 'user_id', 'cascade');
select public.__pt_add_fk_user_profiles('valuation_training_exports', 'valuation_training_exports_created_by_fkey', 'created_by', 'set null');

drop function if exists public.__pt_add_fk_user_profiles(text, text, text, text);

-- ---------------------------------------------------------------------------
-- 7) RPC: consume_tokens + increment_usage → leadsmart_users
-- ---------------------------------------------------------------------------
create or replace function public.consume_tokens(
  p_user_id uuid,
  p_tool_name text,
  p_tokens_required int
)
returns jsonb
language plpgsql
as $$
declare
  v_plan text;
  v_tokens int;
  v_reset timestamptz;
  v_default int;
  v_next_reset timestamptz;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Not authenticated');
  end if;

  if p_tokens_required is null or p_tokens_required < 0 then
    return jsonb_build_object('ok', false, 'message', 'Invalid token cost');
  end if;

  v_next_reset := date_trunc('month', now()) + interval '1 month';

  select ls.plan, ls.tokens_remaining, ls.tokens_reset_date
    into v_plan, v_tokens, v_reset
  from public.leadsmart_users ls
  where ls.user_id = p_user_id
  for update;

  if not found then
    v_plan := 'free';
    v_default := public.plan_default_tokens(v_plan);
    v_tokens := v_default;
    v_reset := v_next_reset;

    insert into public.leadsmart_users (user_id, plan, tokens_remaining, tokens_reset_date)
    values (p_user_id, v_plan, v_tokens, v_reset);
  end if;

  if v_reset is null or now() >= v_reset then
    v_default := public.plan_default_tokens(v_plan);
    v_tokens := v_default;
    v_reset := v_next_reset;

    update public.leadsmart_users
      set tokens_remaining = v_tokens,
          tokens_reset_date = v_reset
    where user_id = p_user_id;
  end if;

  if p_tokens_required = 0 then
    return jsonb_build_object('ok', true, 'plan', v_plan, 'tokens_remaining', v_tokens);
  end if;

  if v_tokens < p_tokens_required then
    return jsonb_build_object(
      'ok', false,
      'plan', v_plan,
      'tokens_remaining', v_tokens,
      'message', 'Upgrade required'
    );
  end if;

  update public.leadsmart_users
    set tokens_remaining = greatest(0, tokens_remaining - p_tokens_required)
    where user_id = p_user_id
    returning tokens_remaining into v_tokens;

  insert into public.usage_logs(user_id, tool_name, tokens_used)
  values (p_user_id, coalesce(nullif(p_tool_name, ''), 'unknown'), p_tokens_required);

  return jsonb_build_object('ok', true, 'plan', v_plan, 'tokens_remaining', v_tokens);
end;
$$;

create or replace function public.increment_usage(p_user_id uuid, p_tool text)
returns jsonb
language plpgsql
as $$
declare
  v_plan text;
  v_status text;
  v_used int := 0;
  v_limit int;
  v_now timestamptz := now();
  v_reset timestamptz;
  v_current_reset timestamptz;
begin
  if p_user_id is null or coalesce(nullif(trim(p_tool), ''), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Invalid input');
  end if;

  v_reset := date_trunc('month', v_now) + interval '1 month';

  select ls.plan, ls.subscription_status, ls.usage_reset_date
    into v_plan, v_status, v_current_reset
  from public.leadsmart_users ls
  where ls.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Profile not found');
  end if;

  if v_current_reset is null or v_current_reset <= v_now then
    update public.leadsmart_users
      set estimator_usage_count = 0,
          cma_usage_count = 0,
          usage_reset_date = v_reset
    where user_id = p_user_id;
  end if;

  if lower(coalesce(v_status, '')) in ('active', 'trialing') then
    if p_tool = 'estimator' then
      update public.leadsmart_users
        set estimator_usage_count = estimator_usage_count + 1
        where user_id = p_user_id
        returning estimator_usage_count into v_used;
      return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', null, 'reset_at', v_reset);
    elsif p_tool = 'cma' then
      update public.leadsmart_users
        set cma_usage_count = cma_usage_count + 1
        where user_id = p_user_id
        returning cma_usage_count into v_used;
      return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', null, 'reset_at', v_reset);
    else
      return jsonb_build_object('ok', false, 'message', 'Unknown tool');
    end if;
  end if;

  if p_tool = 'estimator' then
    v_limit := 3;
    select ls.estimator_usage_count into v_used from public.leadsmart_users ls where ls.user_id = p_user_id;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset, 'status', 402);
    end if;
    update public.leadsmart_users
      set estimator_usage_count = estimator_usage_count + 1
      where user_id = p_user_id
      returning estimator_usage_count into v_used;
    return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset);
  elsif p_tool = 'cma' then
    v_limit := 1;
    select ls.cma_usage_count into v_used from public.leadsmart_users ls where ls.user_id = p_user_id;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset, 'status', 402);
    end if;
    update public.leadsmart_users
      set cma_usage_count = cma_usage_count + 1
      where user_id = p_user_id
      returning cma_usage_count into v_used;
    return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset);
  end if;

  return jsonb_build_object('ok', false, 'message', 'Unknown tool');
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) Drop moved columns from user_profiles
-- ---------------------------------------------------------------------------
alter table if exists public.user_profiles
  drop column if exists role,
  drop column if exists license_number,
  drop column if exists brokerage,
  drop column if exists plan,
  drop column if exists tokens_remaining,
  drop column if exists tokens_reset_date,
  drop column if exists trial_used,
  drop column if exists trial_started_at,
  drop column if exists trial_ends_at,
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id,
  drop column if exists subscription_status,
  drop column if exists oauth_onboarding_completed,
  drop column if exists subscription_current_period_start,
  drop column if exists subscription_current_period_end,
  drop column if exists subscription_cancel_at_period_end,
  drop column if exists estimator_usage_count,
  drop column if exists cma_usage_count,
  drop column if exists usage_reset_date,
  drop column if exists last_reset_date;

drop index if exists public.idx_user_profiles_stripe_customer_id;
drop index if exists public.idx_user_profiles_stripe_subscription_id;
drop index if exists public.idx_user_profiles_trial_ends_at;
drop index if exists public.idx_user_profiles_usage_reset_date;

-- ---------------------------------------------------------------------------
-- 9) Drop deprecated public.profiles
-- ---------------------------------------------------------------------------
drop table if exists public.profiles cascade;

-- ---------------------------------------------------------------------------
-- 10) updated_at triggers (only if set_updated_at exists)
-- ---------------------------------------------------------------------------
do $trg$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_updated_at') then
    execute $sql$
      drop trigger if exists trg_leadsmart_users_updated_at on public.leadsmart_users;
      create trigger trg_leadsmart_users_updated_at
      before update on public.leadsmart_users
      for each row execute function public.set_updated_at();
      drop trigger if exists trg_propertytools_users_updated_at on public.propertytools_users;
      create trigger trg_propertytools_users_updated_at
      before update on public.propertytools_users
      for each row execute function public.set_updated_at();
    $sql$;
  end if;
end $trg$;
