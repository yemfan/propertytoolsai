-- Manual contact intake (POST /api/dashboard/contacts/intake) was 500'ing
-- with "Server error" because the ingestion pipeline writes 6 columns
-- that never made it onto contacts in prod despite living in the
-- ingestion code path:
--   intake_channel, import_job_id, normalized_email, normalized_phone,
--   normalized_address, contact_completeness_score
-- The earlier `column_drift_catchup` migration covered some of these
-- in a later file but its registered version (20260429210626) reflects
-- a snapshot from before they were added — the May 30 file in this
-- repo never landed on prod.
--
-- This migration was already applied to prod via Supabase MCP; it's
-- in source control so it re-runs cleanly on dev/branch DBs.

alter table public.contacts
  add column if not exists intake_channel text,
  add column if not exists import_job_id uuid,
  add column if not exists normalized_email text,
  add column if not exists normalized_phone text,
  add column if not exists normalized_address text,
  add column if not exists contact_completeness_score integer not null default 0;

create index if not exists idx_contacts_normalized_email
  on public.contacts(normalized_email)
  where normalized_email is not null;

create index if not exists idx_contacts_normalized_phone
  on public.contacts(normalized_phone)
  where normalized_phone is not null;

create index if not exists idx_contacts_import_job
  on public.contacts(import_job_id)
  where import_job_id is not null;

comment on column public.contacts.intake_channel is
  'How the contact was added: manual, csv, api, etc. Set by the intake pipeline.';
comment on column public.contacts.contact_completeness_score is
  'Heuristic 0-100 score of how filled-out the contact record is. Recomputed during enrichment.';
