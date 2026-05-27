-- Week 19: Twilio reception config + call log
-- ─────────────────────────────────────────────────────────────────────────────

-- Org: Twilio number + auto-reply settings (used by Reception + Voice pages)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS twilio_number   TEXT,
  ADD COLUMN IF NOT EXISTS auto_reply      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_reply_msg  TEXT    NOT NULL
    DEFAULT 'Hey! We missed your call. We''ll get back to you shortly.';

-- Call log — one row per inbound call from Twilio
CREATE TABLE IF NOT EXISTS calls (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id         UUID        REFERENCES clients(id) ON DELETE SET NULL,

  call_sid          TEXT        UNIQUE,           -- Twilio CallSid for idempotency
  from_number       TEXT        NOT NULL,
  to_number         TEXT        NOT NULL,

  status            TEXT        NOT NULL DEFAULT 'missed'
                                CHECK (status IN ('answered', 'missed', 'voicemail')),
  duration_seconds  INT,
  auto_replied      BOOLEAN     NOT NULL DEFAULT FALSE,
  reply_body        TEXT,
  called_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_org ON calls (organization_id, called_at DESC);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage calls"
  ON calls FOR ALL
  USING  (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));
