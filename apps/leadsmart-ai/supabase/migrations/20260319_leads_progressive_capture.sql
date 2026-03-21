-- Progressive Lead Capture fields

alter table if exists public.leads
  add column if not exists stage text,
  add column if not exists source text,
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists phone text;

create index if not exists idx_leads_stage on public.leads(stage);
create index if not exists idx_leads_email on public.leads(email);

