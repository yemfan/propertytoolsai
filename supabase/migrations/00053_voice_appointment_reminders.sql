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
