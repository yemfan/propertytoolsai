-- PropertyTools AI production backend layer

create table if not exists public.leadsmart_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  status text not null default 'success',
  model text,
  score numeric(8,2),
  intent text,
  timeline text,
  confidence numeric(8,4),
  explanation jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  latency_ms int,
  error text,
  created_at timestamptz not null default now(),
  constraint leadsmart_runs_status_check check (status in ('success','error'))
);

create index if not exists idx_leadsmart_runs_lead_created
  on public.leadsmart_runs(lead_id, created_at desc);

create index if not exists idx_leadsmart_runs_status_created
  on public.leadsmart_runs(status, created_at desc);
