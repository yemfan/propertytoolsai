-- ----------------------------------------------------------------------------
-- Drift reconciliation (repo-first): this DDL was applied to the Core / HelmSmart
-- Supabase project (vpmwsnoosuiknyzdxgtk) out-of-band and was never committed to
-- this migrations folder. It is committed here so a from-scratch replay of
-- apps/helmsmart-web/supabase/migrations/* reproduces Core's actual public schema.
-- Core schema_migrations name: "voice_session_direction"
-- Source (verbatim): supabase/migrations/00050_voice_session_direction.sql
-- This commit changes no database.
-- ----------------------------------------------------------------------------

-- Outbound AI calling. Distinguish AI-placed (outbound) calls from inbound
-- receptionist calls, and record why we called + who we called. Existing rows
-- are inbound (the receptionist answering), so default direction accordingly.

ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound';
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
