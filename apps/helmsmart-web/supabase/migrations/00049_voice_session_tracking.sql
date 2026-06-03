-- ----------------------------------------------------------------------------
-- Drift reconciliation (repo-first): this DDL was applied to the Core / HelmSmart
-- Supabase project (vpmwsnoosuiknyzdxgtk) out-of-band and was never committed to
-- this migrations folder. It is committed here so a from-scratch replay of
-- apps/helmsmart-web/supabase/migrations/* reproduces Core's actual public schema.
-- Core schema_migrations name: "00045_voice_session_tracking"
-- Source (verbatim): supabase/migrations/00045_voice_session_tracking.sql
-- This commit changes no database.
-- ----------------------------------------------------------------------------

-- Voice session tracking: call duration + recording URL
alter table voice_sessions
  add column if not exists duration_seconds integer,
  add column if not exists recording_url text;
