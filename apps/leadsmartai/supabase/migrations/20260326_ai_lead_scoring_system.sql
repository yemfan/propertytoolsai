-- Production-ready AI Lead Scoring System

-- 1) Ensure leads has required columns (safe/idempotent)
alter table if exists public.leads
  add column if not exists city text,
  add column if not exists zip_code text,
  add column if not exists estimated_home_value numeric(12,2);

create index if not exists idx_leads_city on public.leads(city);
create index if not exists idx_leads_zip_code on public.leads(zip_code);
create index if not exists idx_leads_estimated_home_value on public.leads(estimated_home_value);

-- 2) Ensure lead_events exists with compatible lead_id type
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

-- 3) New lead_scores table (compatible lead_id type)
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

