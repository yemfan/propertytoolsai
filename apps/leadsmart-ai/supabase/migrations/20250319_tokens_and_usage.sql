-- Token-based usage + subscription tiers (guest/free/pro/premium)
-- Applies to `public.user_profiles` (NOT `public.users`).

alter table if exists public.user_profiles
  add column if not exists plan text not null default 'free',
  add column if not exists tokens_remaining int not null default 10,
  add column if not exists tokens_reset_date timestamptz not null default (date_trunc('month', now()) + interval '1 month');

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  tokens_used int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_logs_user_id_created_at
  on public.usage_logs(user_id, created_at desc);
create index if not exists idx_usage_logs_tool_name_created_at
  on public.usage_logs(tool_name, created_at desc);

create or replace function public.plan_default_tokens(p_plan text)
returns int
language plpgsql
as $$
begin
  if p_plan = 'pro' then
    return 100;
  elsif p_plan = 'premium' then
    return 300;
  else
    -- free (and any unknown plan) default
    return 10;
  end if;
end;
$$;

-- Atomic token consumption + monthly reset.
-- Returns: ok, tokens_remaining, plan, message
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

  -- Lock the row for update to prevent negative tokens.
  select plan, tokens_remaining, tokens_reset_date
    into v_plan, v_tokens, v_reset
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if not found then
    v_plan := 'free';
    v_default := public.plan_default_tokens(v_plan);
    v_tokens := v_default;
    v_reset := v_next_reset;

    insert into public.user_profiles(user_id, plan, tokens_remaining, tokens_reset_date)
    values (p_user_id, v_plan, v_tokens, v_reset);
  end if;

  -- Monthly reset
  if v_reset is null or now() >= v_reset then
    v_default := public.plan_default_tokens(v_plan);
    v_tokens := v_default;
    v_reset := v_next_reset;

    update public.user_profiles
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

  -- Deduct + log
  update public.user_profiles
    set tokens_remaining = greatest(0, tokens_remaining - p_tokens_required)
  where user_id = p_user_id
  returning tokens_remaining into v_tokens;

  insert into public.usage_logs(user_id, tool_name, tokens_used)
  values (p_user_id, coalesce(nullif(p_tool_name, ''), 'unknown'), p_tokens_required);

  return jsonb_build_object('ok', true, 'plan', v_plan, 'tokens_remaining', v_tokens);
end;
$$;

