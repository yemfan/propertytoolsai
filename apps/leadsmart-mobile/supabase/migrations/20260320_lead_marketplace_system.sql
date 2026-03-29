-- Lead Marketplace System (tool usage -> opportunities -> agent purchase -> CRM leads)
-- Implements:
-- - tool_usage_logs
-- - opportunities with dynamic pricing
-- - SQL function to log usage + auto-generate/update opportunities
-- - SQL function to buy an opportunity (deduct credits + create exclusive lead)
-- - extends existing CRM `public.leads` with marketplace fields

-- =========================
-- TOOL USAGE LOGS
-- =========================
create table if not exists public.tool_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  session_id text not null,
  tool_name text not null,
  property_address text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tool_usage_logs_user_id_created_at
  on public.tool_usage_logs(user_id, created_at desc);
create index if not exists idx_tool_usage_logs_session_id_created_at
  on public.tool_usage_logs(session_id, created_at desc);
create index if not exists idx_tool_usage_logs_property_address_created_at
  on public.tool_usage_logs(property_address, created_at desc);
create index if not exists idx_tool_usage_logs_tool_name_created_at
  on public.tool_usage_logs(tool_name, created_at desc);

-- =========================
-- OPPORTUNITIES
-- =========================
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  property_address text not null,
  lead_type text not null,
  intent_score int not null default 0,
  usage_count int not null default 0,
  estimated_value numeric,
  status text not null default 'available',
  assigned_agent_id uuid,
  price int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_status_check check (status in ('available', 'sold', 'assigned'))
);

-- We keep 1 active "opportunity" record per address+lead_type so the intent/price
-- can be continuously updated. Once sold, that record is no longer available.
create unique index if not exists idx_opportunities_property_address_lead_type
  on public.opportunities(property_address, lead_type);

create index if not exists idx_opportunities_status
  on public.opportunities(status);
create index if not exists idx_opportunities_lead_type
  on public.opportunities(lead_type);
create index if not exists idx_opportunities_property_address
  on public.opportunities(property_address);
create index if not exists idx_opportunities_price
  on public.opportunities(price);

-- =========================
-- MARKETPLACE HELPERS
-- =========================
create or replace function public.marketplace_map_tool_to_lead_type(p_tool_name text)
returns text
language plpgsql
as $$
begin
  if lower(coalesce(p_tool_name, '')) in ('estimator', 'cma') then
    return 'seller';
  elsif lower(coalesce(p_tool_name, '')) = 'mortgage' then
    -- Spec allows buyer/refi; for now we classify mortgage as buyer.
    return 'buyer';
  elsif lower(coalesce(p_tool_name, '')) = 'rental' then
    return 'buyer';
  end if;

  return 'seller';
end;
$$;

create or replace function public.marketplace_compute_intent_score(
  p_usage_count int,
  p_action text
)
returns int
language plpgsql
as $$
declare
  v_usage int := coalesce(p_usage_count, 0);
  v_score int;
begin
  -- Spec: intent_score based on usage frequency.
  -- Baseline + frequency scaling; submit actions get a small boost.
  v_score := 10 + (v_usage * 20);

  if lower(coalesce(p_action, '')) = 'submit' then
    v_score := v_score + 20;
  end if;

  return least(100, greatest(0, v_score));
end;
$$;

create or replace function public.marketplace_compute_price(
  p_intent_score int,
  p_estimated_value numeric,
  p_usage_count int
)
returns int
language plpgsql
as $$
declare
  v_price int := 10; -- base
begin
  -- Spec dynamic pricing rules
  if coalesce(p_intent_score, 0) > 70 then
    v_price := v_price + 20;
  end if;

  if p_estimated_value is not null and p_estimated_value > 1000000 then
    v_price := v_price + 30;
  end if;

  if coalesce(p_usage_count, 0) > 3 then
    v_price := v_price + 15;
  end if;

  return v_price;
end;
$$;

-- =========================
-- LOG USAGE + AUTO-UPsert OPPORTUNITY
-- =========================
create or replace function public.log_tool_usage_and_update_opportunity(
  p_user_id uuid,
  p_session_id text,
  p_tool_name text,
  p_property_address text,
  p_action text,
  p_estimated_value numeric default null
)
returns jsonb
language plpgsql
as $$
declare
  v_lead_type text;
  v_property_address text := trim(coalesce(p_property_address, ''));
  v_action text := lower(coalesce(p_action, 'view'));
  v_session_id text := coalesce(nullif(trim(p_session_id), ''), 'unknown');
  v_usage_count int;
  v_intent_score int;
  v_existing_estimated_value numeric;
  v_estimated_value numeric;
  v_price int;
begin
  if v_property_address = '' then
    return jsonb_build_object('ok', false, 'message', 'property_address is required');
  end if;

  v_lead_type := public.marketplace_map_tool_to_lead_type(p_tool_name);

  insert into public.tool_usage_logs(user_id, session_id, tool_name, property_address, action)
  values (p_user_id, v_session_id, lower(coalesce(p_tool_name, '')), v_property_address, v_action);

  select count(*)
    into v_usage_count
  from public.tool_usage_logs
  where property_address = v_property_address
    and created_at >= now() - interval '90 days'
    and public.marketplace_map_tool_to_lead_type(tool_name) = v_lead_type;

  v_intent_score := public.marketplace_compute_intent_score(v_usage_count, v_action);

  select estimated_value
    into v_existing_estimated_value
  from public.opportunities
  where property_address = v_property_address
    and lead_type = v_lead_type
  limit 1;

  v_estimated_value := coalesce(p_estimated_value, v_existing_estimated_value);
  v_price := public.marketplace_compute_price(v_intent_score, v_estimated_value, v_usage_count);

  insert into public.opportunities(
    property_address,
    lead_type,
    intent_score,
    usage_count,
    estimated_value,
    status,
    price
  )
  values (
    v_property_address,
    v_lead_type,
    v_intent_score,
    v_usage_count,
    v_estimated_value,
    'available',
    v_price
  )
  on conflict (property_address, lead_type) do update set
    -- Once an opportunity is sold, keep it sold (do not change price/intent anymore).
    intent_score = case when opportunities.status = 'available' then excluded.intent_score else opportunities.intent_score end,
    usage_count = case when opportunities.status = 'available' then excluded.usage_count else opportunities.usage_count end,
    estimated_value = coalesce(excluded.estimated_value, opportunities.estimated_value),
    price = case when opportunities.status = 'available' then excluded.price else opportunities.price end,
    status = opportunities.status,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'lead_type', v_lead_type,
    'property_address', v_property_address,
    'usage_count', v_usage_count,
    'intent_score', v_intent_score,
    'estimated_value', v_estimated_value,
    'price', v_price
  );
end;
$$;

-- =========================
-- BUY OPPORTUNITY (ATOMIC)
-- =========================
create or replace function public.buy_opportunity(
  p_user_id uuid,
  p_agent_id uuid,
  p_opportunity_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_opp record;
  v_consumption jsonb;
  v_lead_id bigint;
  v_rating text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Not authenticated', 'status_code', 401);
  end if;

  if p_agent_id is null then
    return jsonb_build_object('ok', false, 'message', 'Agent is required', 'status_code', 400);
  end if;

  select *
    into v_opp
  from public.opportunities
  where id = p_opportunity_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Opportunity not found', 'status_code', 404);
  end if;

  if v_opp.status <> 'available' then
    return jsonb_build_object('ok', false, 'message', 'Opportunity not available', 'status_code', 409);
  end if;

  -- Deduct marketplace credits.
  -- Assumption: opportunity.price is an integer "credits" amount ($1 == 1 credit).
  v_consumption := public.consume_tokens(p_user_id, 'marketplace_lead', coalesce(v_opp.price, 0));
  if (v_consumption->>'ok')::boolean is distinct from true then
    return jsonb_build_object(
      'ok', false,
      'message', v_consumption->>'message',
      'status_code', 402,
      'plan', v_consumption->>'plan',
      'tokens_remaining', (v_consumption->>'tokens_remaining')::int
    );
  end if;

  v_rating := case when coalesce(v_opp.intent_score, 0) > 70 then 'hot' else 'warm' end;

  -- Insert lead (exclusive by marketplace_opportunity_id).
  begin
    insert into public.leads(
      agent_id,
      property_address,
      lead_type,
      contact_info,
      source,
      lead_status,
      notes,
      rating,
      contact_frequency,
      contact_method,
      next_contact_at,
      marketplace_opportunity_id
    )
    values (
      p_agent_id,
      v_opp.property_address,
      v_opp.lead_type,
      null,
      'marketplace',
      'new',
      null,
      v_rating,
      'weekly',
      'email',
      now() + interval '7 days',
      v_opp.id
    )
    returning id into v_lead_id;
  exception
    when unique_violation then
      select id into v_lead_id
      from public.leads
      where marketplace_opportunity_id = v_opp.id
      limit 1;
  end;

  update public.opportunities
  set status = 'sold',
      assigned_agent_id = p_agent_id,
      updated_at = now()
  where id = p_opportunity_id;

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'opportunity_id', p_opportunity_id,
    'price', v_opp.price
  );
end;
$$;

-- =========================
-- EXTEND CRM LEADS WITH MARKETPLACE FIELDS
-- =========================
alter table if exists public.leads
  add column if not exists lead_type text;

alter table if exists public.leads
  add column if not exists contact_info text;

alter table if exists public.leads
  add column if not exists marketplace_opportunity_id uuid;

create unique index if not exists idx_leads_marketplace_opportunity_unique
  on public.leads(marketplace_opportunity_id)
  where marketplace_opportunity_id is not null;

create index if not exists idx_leads_marketplace_opportunity_id
  on public.leads(marketplace_opportunity_id);

create index if not exists idx_leads_lead_type
  on public.leads(lead_type);

