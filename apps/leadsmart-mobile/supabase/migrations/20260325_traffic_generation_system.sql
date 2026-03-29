-- Traffic generation + attribution tracking

alter table if exists public.leads
  add column if not exists traffic_source text,
  add column if not exists lead_quality text;

create index if not exists idx_leads_traffic_source on public.leads(traffic_source);
create index if not exists idx_leads_lead_quality on public.leads(lead_quality);

create table if not exists public.traffic_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- page_view | conversion
  page_path text not null,
  city text,
  source text,
  campaign text,
  lead_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_traffic_events_event_type_created_at
  on public.traffic_events(event_type, created_at desc);
create index if not exists idx_traffic_events_page_path_created_at
  on public.traffic_events(page_path, created_at desc);
create index if not exists idx_traffic_events_source_created_at
  on public.traffic_events(source, created_at desc);
create index if not exists idx_traffic_events_lead_id_created_at
  on public.traffic_events(lead_id, created_at desc);

