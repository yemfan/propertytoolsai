-- Idempotent: table is created in 20260425900000_create_lead_followups.sql
alter table if exists public.lead_followups
  add column if not exists sequence_key text null,
  add column if not exists template_key text null,
  add column if not exists recipient_name text null,
  add column if not exists recipient_email text null,
  add column if not exists recipient_phone text null;
