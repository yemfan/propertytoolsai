-- =============================================================================
-- Canonical user model (single source of truth per domain)
--
-- public.user_profiles (1:1 auth.users)
--   Shared identity + contact: user_id PK/FK auth, full_name, email, phone,
--   avatar_url, invited_by, invited_at, is_active, signup_origin_app, timestamps.
--   No RBAC, no LeadSmart billing/tokens, no PropertyTools tier.
--
-- public.leadsmart_users (1:1 user_profiles.user_id)
--   LeadSmart RBAC (role), CRM ids (agent_id, broker_id, support_id), license/brokerage,
--   plan, tokens, trials, Stripe subscription fields, oauth_onboarding_completed,
--   estimator/cma usage counters.
--
-- public.propertytools_users (1:1 user_profiles.user_id)
--   Consumer tier (basic | premium) and PropertyTools Stripe snapshot only.
--
-- Older databases may still have LeadSmart columns duplicated on user_profiles
-- (before 20260473550000 section 8 applied). This migration merges any drift
-- into leadsmart_users / propertytools_users, then drops duplicates idempotently.
-- =============================================================================

do $prune$
begin
  -- Detect legacy slab: `plan` on user_profiles was always part of the duplicated set.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'plan'
  ) then
    raise notice '20260473910000: merging legacy user_profiles columns into leadsmart_users / propertytools_users.';

    execute $merge_ls$
    update public.leadsmart_users ls
    set
      role = coalesce(nullif(trim(ls.role), ''), nullif(trim(up.role), ''), 'user'),
      license_number = coalesce(ls.license_number, up.license_number),
      brokerage = coalesce(ls.brokerage, up.brokerage),
      plan = coalesce(nullif(trim(ls.plan), ''), nullif(trim(up.plan), ''), 'free'),
      tokens_remaining = coalesce(ls.tokens_remaining, up.tokens_remaining, 10),
      tokens_reset_date = coalesce(
        ls.tokens_reset_date,
        up.tokens_reset_date,
        date_trunc('month', now()) + interval '1 month'
      ),
      trial_used = coalesce(ls.trial_used, up.trial_used, false),
      trial_started_at = coalesce(ls.trial_started_at, up.trial_started_at),
      trial_ends_at = coalesce(ls.trial_ends_at, up.trial_ends_at),
      stripe_customer_id = coalesce(ls.stripe_customer_id, up.stripe_customer_id),
      stripe_subscription_id = coalesce(ls.stripe_subscription_id, up.stripe_subscription_id),
      subscription_status = coalesce(ls.subscription_status, up.subscription_status),
      oauth_onboarding_completed = coalesce(ls.oauth_onboarding_completed, up.oauth_onboarding_completed, false),
      subscription_current_period_start = coalesce(
        ls.subscription_current_period_start,
        up.subscription_current_period_start
      ),
      subscription_current_period_end = coalesce(
        ls.subscription_current_period_end,
        up.subscription_current_period_end
      ),
      subscription_cancel_at_period_end = coalesce(
        ls.subscription_cancel_at_period_end,
        up.subscription_cancel_at_period_end,
        false
      ),
      estimator_usage_count = coalesce(ls.estimator_usage_count, up.estimator_usage_count, 0),
      cma_usage_count = coalesce(ls.cma_usage_count, up.cma_usage_count, 0),
      usage_reset_date = coalesce(ls.usage_reset_date, up.usage_reset_date),
      last_reset_date = coalesce(ls.last_reset_date, up.last_reset_date)
    from public.user_profiles up
    where up.user_id = ls.user_id
  $merge_ls$;

  execute $ins_ls$
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
      coalesce(nullif(trim(up.role), ''), 'user'),
      up.license_number,
      up.brokerage,
      coalesce(nullif(trim(up.plan), ''), 'free'),
      coalesce(up.tokens_remaining, 10),
      coalesce(
        up.tokens_reset_date,
        date_trunc('month', now()) + interval '1 month'
      ),
      coalesce(up.trial_used, false),
      up.trial_started_at,
      up.trial_ends_at,
      up.stripe_customer_id,
      up.stripe_subscription_id,
      up.subscription_status,
      coalesce(up.oauth_onboarding_completed, false),
      up.subscription_current_period_start,
      up.subscription_current_period_end,
      coalesce(up.subscription_cancel_at_period_end, false),
      coalesce(up.estimator_usage_count, 0),
      coalesce(up.cma_usage_count, 0),
      up.usage_reset_date,
      up.last_reset_date
    from public.user_profiles up
    where not exists (select 1 from public.leadsmart_users ls where ls.user_id = up.user_id)
    on conflict (user_id) do nothing
  $ins_ls$;

  execute $tier_pt$
    update public.propertytools_users pt
    set tier = case
      when lower(coalesce(up.role, '')) = 'user'
        and (
          nullif(trim(up.plan), '') in ('premium', 'pro')
          or lower(coalesce(up.subscription_status, '')) in ('active', 'trialing')
        )
      then 'premium'
      else pt.tier
    end
    from public.user_profiles up
    where pt.user_id = up.user_id
  $tier_pt$;

  execute $ins_pt$
    insert into public.propertytools_users (user_id, tier)
    select ls.user_id, 'basic'::text
    from public.leadsmart_users ls
    where not exists (select 1 from public.propertytools_users pt where pt.user_id = ls.user_id)
    on conflict (user_id) do nothing
  $ins_pt$;

  else
    raise notice '20260473910000: user_profiles has no legacy plan column — skip merge.';
  end if;
end;
$prune$;

-- Drop duplicated LeadSmart / billing columns from user_profiles (idempotent).
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

comment on table public.user_profiles is
  'Shared profile row per auth user: contact fields, avatar, invite metadata, signup_origin_app. RBAC and LeadSmart billing live in leadsmart_users; PropertyTools consumer tier in propertytools_users.';

comment on table public.leadsmart_users is
  'LeadSmart-only: role (RBAC), CRM linkage ids, plan/tokens/trials, Stripe subscription fields, tool usage counters. FK user_profiles(user_id) on delete cascade.';

comment on table public.propertytools_users is
  'PropertyTools consumer: tier basic|premium and PT Stripe snapshot. FK user_profiles(user_id) on delete cascade.';
