-- ----------------------------------------------------------------------------
-- Drift reconciliation (repo-first): this DDL was applied to the Core / HelmSmart
-- Supabase project (vpmwsnoosuiknyzdxgtk) out-of-band and was never committed to
-- this migrations folder. It is committed here so a from-scratch replay of
-- apps/helmsmart-web/supabase/migrations/* reproduces Core's actual public schema.
-- Core schema_migrations name: "voice_appointment_reminders"
-- Source (verbatim): supabase/migrations/00053_voice_appointment_reminders.sql
-- Depends on outbound_call_queue (created in 00056_outbound_call_queue.sql).
-- This commit changes no database.
-- ----------------------------------------------------------------------------

-- Automatic appointment-reminder calls. Per-org enable + how long before the
-- appointment to call. Reminders reuse outbound_call_queue (one row per
-- appointment, keyed by event_id) so they appear in the Voice tab with status.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS voice_reminder_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS voice_reminder_lead_minutes integer NOT NULL DEFAULT 1440; -- 24h

ALTER TABLE outbound_call_queue ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE CASCADE;

-- One reminder per appointment (idempotent scheduling across cron runs).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_outbound_queue_event_reminder
  ON outbound_call_queue(event_id, purpose)
  WHERE event_id IS NOT NULL;
