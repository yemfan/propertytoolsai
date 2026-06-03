-- ----------------------------------------------------------------------------
-- Drift reconciliation (repo-first): this DDL was applied to the Core / HelmSmart
-- Supabase project (vpmwsnoosuiknyzdxgtk) out-of-band and was never committed to
-- this migrations folder. It is committed here so a from-scratch replay of
-- apps/helmsmart-web/supabase/migrations/* reproduces Core's actual public schema.
-- Core schema_migrations name: "voice_agent_business_name_zh"
-- Source (verbatim): supabase/migrations/00052_voice_agent_business_name_zh.sql
-- This commit changes no database.
-- ----------------------------------------------------------------------------

-- Chinese business name for the voice receptionist. When the agent speaks Chinese
-- it refers to the business by this name; English uses voice_agent_business_name
-- (or the account name). Blank = fall back to the English/display name.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS voice_agent_business_name_zh text;
