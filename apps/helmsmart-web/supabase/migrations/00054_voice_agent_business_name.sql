-- ----------------------------------------------------------------------------
-- Drift reconciliation (repo-first): this DDL was applied to the Core / HelmSmart
-- Supabase project (vpmwsnoosuiknyzdxgtk) out-of-band and was never committed to
-- this migrations folder. It is committed here so a from-scratch replay of
-- apps/helmsmart-web/supabase/migrations/* reproduces Core's actual public schema.
-- Core schema_migrations name: "voice_agent_business_name"
-- Source (verbatim): supabase/migrations/00049_voice_agent_business_name.sql
-- This commit changes no database.
-- ----------------------------------------------------------------------------

-- Optional per-business display name the voice receptionist uses when it speaks
-- (greeting + prompt + the {{business_name}} variable), e.g. a brand or DBA name
-- distinct from the legal entity name in Settings. Blank = fall back to the
-- organization's name. Lets us onboard a customer whose receptionist should
-- announce a different name than their account/billing name.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS voice_agent_business_name text;
