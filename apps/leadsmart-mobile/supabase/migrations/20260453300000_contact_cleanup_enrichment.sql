-- Contact cleanup, normalization, duplicate tracking, and enrichment runs.
-- Lead IDs are bigint in this project.

alter table if exists public.leads
  add column if not exists normalized_email text null,
  add column if not exists normalized_phone text null,
  add column if not exists normalized_address text null,
  add column if not exists contact_completeness_score integer not null default 0,
  add column if not exists enrichment_status text null,
  add column if not exists inferred_contact_type text null,
  add column if not exists inferred_lifecycle_stage text null,
  add column if not exists preferred_contact_time text null,
  add column if not exists mailing_address text null,
  add column if not exists merged_into_lead_id bigint null references public.leads(id) on delete set null,
  add column if not exists duplicate_group_key text null,
  add column if not exists notes_summary text null;

comment on column public.leads.merged_into_lead_id is 'When set, this row is archived as a duplicate of the referenced lead.';
comment on column public.leads.duplicate_group_key is 'Optional stable key for grouping related duplicates (e.g. hash of email+phone).';

create table if not exists public.lead_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  primary_lead_id bigint not null references public.leads(id) on delete cascade,
  duplicate_lead_id bigint not null references public.leads(id) on delete cascade,
  confidence_score integer not null,
  reason_json jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'merged', 'ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (primary_lead_id, duplicate_lead_id),
  check (primary_lead_id <> duplicate_lead_id)
);

create table if not exists public.lead_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  run_type text not null
    check (run_type in ('cleanup', 'enrichment', 'merge')),
  status text not null default 'completed',
  changes_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_normalized_email on public.leads(normalized_email);
create index if not exists idx_leads_normalized_phone on public.leads(normalized_phone);
create index if not exists idx_leads_duplicate_group_key on public.leads(duplicate_group_key);
create index if not exists idx_leads_merged_into on public.leads(merged_into_lead_id)
  where merged_into_lead_id is not null;

create index if not exists idx_duplicate_candidates_status
  on public.lead_duplicate_candidates(status, confidence_score desc);

create index if not exists idx_lead_enrichment_runs_lead
  on public.lead_enrichment_runs(lead_id, created_at desc);
