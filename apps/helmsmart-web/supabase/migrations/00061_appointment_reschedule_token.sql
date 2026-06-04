-- Phase 2: per-appointment reschedule token
-- ─────────────────────────────────────────────────────────────────────────────
-- Each event gets a unique reschedule_token UUID. Customers visit
-- /reschedule/[token] to pick a new time for an appointment — no login required.
-- Regenerating the token (update reschedule_token = gen_random_uuid()) invalidates
-- the old link immediately. Mirrors clients.portal_token (00015).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reschedule_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS events_reschedule_token_idx ON events (reschedule_token);
