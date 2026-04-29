-- CSV / business-card import jobs and per-row staging for LeadSmart AI contact intake.
-- agent_id follows public.agents.id (uuid or bigint).

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.contact_import_jobs (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents (id) on delete cascade,
        created_by uuid null,
        intake_channel text not null
          check (intake_channel in ('csv', 'business_card', 'manual_batch')),
        status text not null default 'draft'
          check (status in ('draft', 'mapping', 'preview', 'processing', 'completed', 'failed', 'cancelled')),
        file_name text null,
        column_mapping jsonb not null default '{}'::jsonb,
        duplicate_strategy text null
          check (duplicate_strategy is null or duplicate_strategy in ('skip', 'merge', 'create_anyway')),
        summary jsonb not null default '{}'::jsonb,
        error_message text null,
        scan_draft jsonb null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.contact_import_jobs (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents (id) on delete cascade,
        created_by uuid null,
        intake_channel text not null
          check (intake_channel in ('csv', 'business_card', 'manual_batch')),
        status text not null default 'draft'
          check (status in ('draft', 'mapping', 'preview', 'processing', 'completed', 'failed', 'cancelled')),
        file_name text null,
        column_mapping jsonb not null default '{}'::jsonb,
        duplicate_strategy text null
          check (duplicate_strategy is null or duplicate_strategy in ('skip', 'merge', 'create_anyway')),
        summary jsonb not null default '{}'::jsonb,
        error_message text null,
        scan_draft jsonb null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for contact_import_jobs: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_contact_import_jobs_agent_created
  on public.contact_import_jobs (agent_id, created_at desc);

create index if not exists idx_contact_import_jobs_status
  on public.contact_import_jobs (status, updated_at desc);

comment on table public.contact_import_jobs is
  'Import batches (CSV, business card review, optional manual batch); rows staged in contact_import_rows.';
comment on column public.contact_import_jobs.scan_draft is
  'For business card: OCR payload + parser output until user confirms (never auto-saves to CRM).';

create table if not exists public.contact_import_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.contact_import_jobs (id) on delete cascade,
  row_index int not null,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb null,
  duplicate_lead_id bigint null references public.leads (id) on delete set null,
  duplicate_confidence int null,
  resolution text not null default 'pending'
    check (resolution in ('pending', 'inserted', 'skipped', 'merged', 'error')),
  lead_id bigint null references public.leads (id) on delete set null,
  error_message text null,
  created_at timestamptz not null default now(),
  unique (job_id, row_index)
);

create index if not exists idx_contact_import_rows_job
  on public.contact_import_rows (job_id, row_index);

create index if not exists idx_contact_import_rows_duplicate
  on public.contact_import_rows (duplicate_lead_id)
  where duplicate_lead_id is not null;

comment on table public.contact_import_rows is
  'Staged CSV rows or parsed card fields; normalized + duplicate hints before finalize.';

drop trigger if exists trg_contact_import_jobs_updated_at on public.contact_import_jobs;
create trigger trg_contact_import_jobs_updated_at
before update on public.contact_import_jobs
for each row execute function public.set_updated_at();

alter table public.leads
  add column if not exists intake_channel text null;
alter table public.leads
  add column if not exists import_job_id uuid null references public.contact_import_jobs (id) on delete set null;

comment on column public.leads.intake_channel is
  'manual | csv_import | business_card — complements `source` (campaign/tool).';
comment on column public.leads.import_job_id is
  'Set when the lead was created from a contact import job.';
