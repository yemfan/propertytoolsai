-- Compat columns missed by the contacts consolidation rebuild.
--
-- crm_tasks: the 20260480100000 consolidation recreated crm_tasks without
--   `task_type` and `created_by` which the mobile Calendar API selects and inserts.
--
-- nurture_alerts: was created with `lead_id bigint` (old leads PK) before the
--   leads → contacts migration. Mobile Inbox queries `contact_id` (uuid). Add the
--   column nullable so queries don't crash; rows are populated going forward.

alter table public.crm_tasks
  add column if not exists task_type  text,
  add column if not exists created_by text;

alter table public.nurture_alerts
  add column if not exists contact_id uuid
    references public.contacts(id) on delete cascade;

create index if not exists idx_nurture_alerts_contact_id_created_at
  on public.nurture_alerts(contact_id, created_at desc)
  where contact_id is not null;
