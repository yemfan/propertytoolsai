-- ----------------------------------------------------------------------------
-- Drift reconciliation (repo-first): this DDL was applied to the Core / HelmSmart
-- Supabase project (vpmwsnoosuiknyzdxgtk) out-of-band and was never committed to
-- this migrations folder. It is committed here so a from-scratch replay of
-- apps/helmsmart-web/supabase/migrations/* reproduces Core's actual public schema.
-- Core schema_migrations name: "00046_voice_session_billed"
-- Source (verbatim): supabase/migrations/00046_voice_session_billed.sql
-- This commit changes no database.
-- ----------------------------------------------------------------------------

-- Track which voice calls have been billed so we never double-charge
alter table voice_sessions
  add column if not exists billed_at timestamptz;
