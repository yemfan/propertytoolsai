-- ----------------------------------------------------------------------------
-- Drift reconciliation (repo-first): this DDL was applied to the Core / HelmSmart
-- Supabase project (vpmwsnoosuiknyzdxgtk) out-of-band and was never committed to
-- this migrations folder. It is committed here so a from-scratch replay of
-- apps/helmsmart-web/supabase/migrations/* reproduces Core's actual public schema.
-- Core schema_migrations name: "voice_agent_name"
-- Source (verbatim): supabase/migrations/00048_voice_agent_name.sql
-- This commit changes no database.
-- ----------------------------------------------------------------------------

-- Per-business name for the voice receptionist (e.g. "Maria"), so the agent can
-- introduce itself by name. Configured on the Voice page and woven into the
-- per-business system prompt and greeting. NULL/empty = the agent stays unnamed.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS voice_agent_name text;
