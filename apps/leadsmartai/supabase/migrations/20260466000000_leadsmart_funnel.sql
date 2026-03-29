-- Activation funnel + AI usage (UTC month) for free/starter tiers.
-- Requires public.profiles(id) (auth users).

create table if not exists public.leadsmart_funnel_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  onboarding_completed_at timestamptz,
  first_reply_at timestamptz,
  first_ai_usage_at timestamptz,
  /** First day of the UTC month for `ai_usage_count`. */
  ai_usage_month date,
  ai_usage_count int not null default 0,
  last_upgrade_prompt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_leadsmart_funnel_state_updated_at on public.leadsmart_funnel_state;
create trigger trg_leadsmart_funnel_state_updated_at
before update on public.leadsmart_funnel_state
for each row execute function public.set_updated_at();

create index if not exists idx_leadsmart_funnel_onboarding
  on public.leadsmart_funnel_state (onboarding_completed_at)
  where onboarding_completed_at is not null;

comment on table public.leadsmart_funnel_state is
  'Per-user activation milestones and monthly AI draft usage (free/starter caps).';

create table if not exists public.leadsmart_funnel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leadsmart_funnel_events_user_type
  on public.leadsmart_funnel_events (user_id, event_type, created_at desc);

create index if not exists idx_leadsmart_funnel_events_type_created
  on public.leadsmart_funnel_events (event_type, created_at desc);

comment on table public.leadsmart_funnel_events is
  'Append-only funnel analytics (onboarding, activation, upgrade intent, conversion).';

/**
 * Atomically consume one AI credit when `p_monthly_limit` is finite (>0 and < 999999).
 * Unlimited: marks first_ai_usage_at, does not increment counter.
 */
create or replace function public.leadsmart_try_consume_ai_credit(p_user_id uuid, p_monthly_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := (date_trunc('month', timezone('utc', now())))::date;
  rec public.leadsmart_funnel_state%rowtype;
  v_next int;
begin
  insert into public.leadsmart_funnel_state (user_id, ai_usage_month, ai_usage_count, updated_at)
  values (p_user_id, v_month, 0, now())
  on conflict (user_id) do nothing;

  select * into rec from public.leadsmart_funnel_state where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('allowed', false, 'error', 'no_row');
  end if;

  if rec.ai_usage_month is distinct from v_month then
    update public.leadsmart_funnel_state
    set ai_usage_month = v_month, ai_usage_count = 0, updated_at = now()
    where user_id = p_user_id;
    rec.ai_usage_month := v_month;
    rec.ai_usage_count := 0;
  end if;

  if p_monthly_limit <= 0 or p_monthly_limit >= 999999 then
    update public.leadsmart_funnel_state
    set
      first_ai_usage_at = coalesce(first_ai_usage_at, now()),
      updated_at = now()
    where user_id = p_user_id;
    return jsonb_build_object('allowed', true, 'unlimited', true);
  end if;

  if rec.ai_usage_count >= p_monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'count', rec.ai_usage_count,
      'limit', p_monthly_limit
    );
  end if;

  v_next := rec.ai_usage_count + 1;
  update public.leadsmart_funnel_state
  set
    ai_usage_count = v_next,
    first_ai_usage_at = coalesce(first_ai_usage_at, now()),
    updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object('allowed', true, 'count', v_next, 'limit', p_monthly_limit);
end;
$$;
