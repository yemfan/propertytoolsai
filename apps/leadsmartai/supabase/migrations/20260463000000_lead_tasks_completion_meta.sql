-- lead_tasks: completion timestamp + optional metadata for automation / future AI tasks.

alter table if exists public.lead_tasks
  add column if not exists completed_at timestamptz null,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

comment on column public.lead_tasks.completed_at is 'Set when status becomes done.';
comment on column public.lead_tasks.metadata_json is 'Opaque payload (e.g. AI task provenance).';

create index if not exists idx_lead_tasks_open_due
  on public.lead_tasks(lead_id, due_at)
  where status = 'open';
