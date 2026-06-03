-- ----------------------------------------------------------------------------
-- Drift reconciliation (repo-first): this DDL was applied to the Core / HelmSmart
-- Supabase project (vpmwsnoosuiknyzdxgtk) out-of-band and was never committed to
-- this migrations folder. It is committed here so a from-scratch replay of
-- apps/helmsmart-web/supabase/migrations/* reproduces Core's actual public schema.
-- Core schema_migrations name: "add_google_event_id_to_events"
-- Source (verbatim): supabase/migrations/00047_add_google_event_id_to_events.sql
-- This commit changes no database.
-- ----------------------------------------------------------------------------

-- Add google_event_id column to track Google Calendar event mapping
ALTER TABLE events
ADD COLUMN google_event_id TEXT,
ADD CONSTRAINT events_google_event_id_unique UNIQUE(organization_id, google_event_id);

-- Index for efficient lookups when syncing
CREATE INDEX idx_events_google_event_id ON events(organization_id, google_event_id)
WHERE google_event_id IS NOT NULL;
