-- Full AI system bundle migration (idempotent)
-- Includes, in dependency-safe order:
-- 1) City market data engine
-- 2) AI lead pricing engine
-- 3) AI lead scoring system
-- 4) AI SMS auto-follow system

-- =====================================================
-- 1) CITY MARKET DATA ENGINE
-- =====================================================
create table if not exists public.city_market_data (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text not null,
  median_price numeric(12,2) not null default 0,
  price_per_sqft numeric(10,2) not null default 0,
  trend text not null default 'stable',
  days_on_market integer not null default 0,
  inventory integer not null default 0,
  source text not null default 'fallback',
  raw_payload jsonb not null default '{}'::jsonb,
  ai_market_summary text,
  ai_seller_recommendation text,
  last_fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint city_market_data_trend_check check (trend in ('up', 'down', 'stable'))
);

create unique index if not exists uq_city_market_data_city_state
  on public.city_market_data (city, state);

create index if not exists idx_city_market_data_expires_at
  on public.city_market_data (expires_at);

create index if not exists idx_city_market_data_last_fetched
  on public.city_market_data (last_fetched_at desc);

-- =====================================================
-- 2) AI LEAD PRICING ENGINE
-- =====================================================
create table if not exists public.lead_pricing_weights (
  id uuid primary key default gen_random_uuid(),
  model_version text not null default 'v1',
  behavior_weight numeric(6,4) not null default 0.25,
  engagement_weight numeric(6,4) not null default 0.25,
  profile_weight numeric(6,4) not null default 0.25,
  market_weight numeric(6,4) not null default 0.25,
  base_price numeric(10,2) not null default 10,
  updated_from_learning boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_pricing_weights_model_created
  on public.lead_pricing_weights(model_version, created_at desc);

create table if not exists public.lead_pricing_predictions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid null references public.opportunities(id) on delete set null,
  lead_id bigint null references public.leads(id) on delete set null,
  property_address text,
  city text,
  state text,
  model_version text not null default 'v1',
  behavior_score numeric(8,2) not null default 0,
  engagement_score numeric(8,2) not null default 0,
  profile_score numeric(8,2) not null default 0,
  market_score numeric(8,2) not null default 0,
  lead_score numeric(8,2) not null default 0,
  score_multiplier numeric(8,4) not null default 1,
  demand_multiplier numeric(8,4) not null default 1,
  price_credits int not null default 0,
  commission_value numeric(12,2) not null default 0,
  close_probability numeric(8,4) not null default 0,
  expected_revenue numeric(12,2) not null default 0,
  explanation text not null default '',
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_pricing_predictions_created
  on public.lead_pricing_predictions(created_at desc);
create index if not exists idx_lead_pricing_predictions_opportunity
  on public.lead_pricing_predictions(opportunity_id, created_at desc);
create index if not exists idx_lead_pricing_predictions_lead
  on public.lead_pricing_predictions(lead_id, created_at desc);

insert into public.lead_pricing_weights (
  model_version,
  behavior_weight,
  engagement_weight,
  profile_weight,
  market_weight,
  base_price,
  updated_from_learning,
  notes
)
select
  'v1',
  0.25,
  0.25,
  0.25,
  0.25,
  10,
  false,
  'Initial equal-weight baseline.'
where not exists (
  select 1 from public.lead_pricing_weights where model_version = 'v1'
);

-- =====================================================
-- 3) AI LEAD SCORING SYSTEM
-- =====================================================
alter table if exists public.leads
  add column if not exists city text,
  add column if not exists zip_code text,
  add column if not exists estimated_home_value numeric(12,2);

create index if not exists idx_leads_city on public.leads(city);
create index if not exists idx_leads_zip_code on public.leads(zip_code);
create index if not exists idx_leads_estimated_home_value on public.leads(estimated_home_value);

-- Ensure lead_events exists with compatible lead_id type
do $$
declare
  v_leads_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into v_leads_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'leads'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_leads_id_type is null then
    v_leads_id_type := 'bigint';
  end if;

  execute format(
    'create table if not exists public.lead_events (
      id uuid primary key default gen_random_uuid(),
      lead_id %s not null references public.leads(id) on delete cascade,
      event_type text not null,
      metadata jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now()
    )',
    v_leads_id_type
  );
end $$;

create index if not exists idx_lead_events_lead_created
  on public.lead_events(lead_id, created_at desc);
create index if not exists idx_lead_events_type_created
  on public.lead_events(event_type, created_at desc);

-- Ensure lead_scores exists with compatible lead_id type
do $$
declare
  v_leads_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into v_leads_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'leads'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_leads_id_type is null then
    v_leads_id_type := 'bigint';
  end if;

  execute format(
    'create table if not exists public.lead_scores (
      id uuid primary key default gen_random_uuid(),
      lead_id %s not null references public.leads(id) on delete cascade,
      score numeric(8,2) not null default 0,
      intent text not null default ''low'',
      timeline text not null default ''6+ months'',
      confidence numeric(8,4) not null default 0.2,
      explanation jsonb not null default ''[]''::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )',
    v_leads_id_type
  );
end $$;

create index if not exists idx_lead_scores_lead_updated
  on public.lead_scores(lead_id, updated_at desc);
create index if not exists idx_lead_scores_score_updated
  on public.lead_scores(score desc, updated_at desc);

-- =====================================================
-- 4) AI SMS AUTO-FOLLOW SYSTEM
-- =====================================================
create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  agent_id uuid,
  message text not null,
  direction text not null,
  created_at timestamptz not null default now(),
  constraint sms_messages_direction_check check (direction in ('inbound','outbound'))
);

create index if not exists idx_sms_messages_lead_created
  on public.sms_messages(lead_id, created_at desc);
create index if not exists idx_sms_messages_agent_created
  on public.sms_messages(agent_id, created_at desc);

alter table if exists public.leads
  add column if not exists sms_ai_enabled boolean not null default true,
  add column if not exists sms_agent_takeover boolean not null default false,
  add column if not exists sms_followup_stage int not null default 0,
  add column if not exists sms_last_outbound_at timestamptz,
  add column if not exists sms_last_inbound_at timestamptz,
  add column if not exists sms_opted_out_at timestamptz;

create index if not exists idx_leads_sms_ai_enabled on public.leads(sms_ai_enabled);
create index if not exists idx_leads_sms_agent_takeover on public.leads(sms_agent_takeover);
create index if not exists idx_leads_sms_followup_stage on public.leads(sms_followup_stage);
create index if not exists idx_leads_sms_last_outbound_at on public.leads(sms_last_outbound_at desc);
