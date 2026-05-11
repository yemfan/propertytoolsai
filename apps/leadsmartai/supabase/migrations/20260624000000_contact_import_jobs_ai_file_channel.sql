-- Extend `contact_import_jobs.intake_channel` allowed values to include
-- 'ai_file' for the new AI-extract-from-file flow (PDF / image / text
-- file → AI extracts a list of contacts → preview-and-edit → bulk save).
--
-- Existing values 'csv', 'business_card', 'manual_batch' stay valid;
-- new value 'ai_file' covers the unified AI-extraction surface so the
-- import-history page can tell the three flows apart.
--
-- No data migration needed — pre-existing rows already use one of the
-- three existing values.

alter table public.contact_import_jobs
  drop constraint if exists contact_import_jobs_intake_channel_check;

alter table public.contact_import_jobs
  add constraint contact_import_jobs_intake_channel_check
    check (intake_channel in ('csv', 'business_card', 'manual_batch', 'ai_file'));
