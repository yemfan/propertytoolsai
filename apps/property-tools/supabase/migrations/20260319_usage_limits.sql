-- Usage counters + paywall limits

alter table if exists public.user_profiles
  add column if not exists estimator_usage_count int not null default 0,
  add column if not exists cma_usage_count int not null default 0,
  add column if not exists usage_reset_date timestamptz;

create index if not exists idx_user_profiles_usage_reset_date
  on public.user_profiles(usage_reset_date);

-- Atomic increment + limit enforcement for free users.
-- Returns JSON: { ok: bool, tool: text, used: int, limit: int|null, reset_at: timestamptz|null }
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

  -- Monthly reset at first of next month (UTC)
  v_reset := date_trunc('month', v_now) + interval '1 month';

  select plan, subscription_status, usage_reset_date
    into v_plan, v_status, v_current_reset
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Profile not found');
  end if;

  -- Reset if needed
  if v_current_reset is null or v_current_reset <= v_now then
    update public.user_profiles
      set estimator_usage_count = 0,
          cma_usage_count = 0,
          usage_reset_date = v_reset
    where user_id = p_user_id;
  end if;

  -- If subscribed (active or trialing), don't enforce limits; still track.
  if lower(coalesce(v_status,'')) in ('active','trialing') then
    if p_tool = 'estimator' then
      update public.user_profiles
        set estimator_usage_count = estimator_usage_count + 1
      where user_id = p_user_id
      returning estimator_usage_count into v_used;
      return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', null, 'reset_at', v_reset);
    elsif p_tool = 'cma' then
      update public.user_profiles
        set cma_usage_count = cma_usage_count + 1
      where user_id = p_user_id
      returning cma_usage_count into v_used;
      return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', null, 'reset_at', v_reset);
    else
      return jsonb_build_object('ok', false, 'message', 'Unknown tool');
    end if;
  end if;

  -- Free limits
  if p_tool = 'estimator' then
    v_limit := 3;
    select estimator_usage_count into v_used from public.user_profiles where user_id = p_user_id;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset, 'status', 402);
    end if;
    update public.user_profiles
      set estimator_usage_count = estimator_usage_count + 1
    where user_id = p_user_id
    returning estimator_usage_count into v_used;
    return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset);
  elsif p_tool = 'cma' then
    v_limit := 1;
    select cma_usage_count into v_used from public.user_profiles where user_id = p_user_id;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset, 'status', 402);
    end if;
    update public.user_profiles
      set cma_usage_count = cma_usage_count + 1
    where user_id = p_user_id
    returning cma_usage_count into v_used;
    return jsonb_build_object('ok', true, 'tool', p_tool, 'used', v_used, 'limit', v_limit, 'reset_at', v_reset);
  end if;

  return jsonb_build_object('ok', false, 'message', 'Unknown tool');
end;
$$;

