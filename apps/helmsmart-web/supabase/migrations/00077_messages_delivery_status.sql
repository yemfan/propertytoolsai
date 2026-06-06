-- SMS delivery tracking — let the per-client SMS thread show Delivered/Failed
-- instead of just "Sent". Populated by the Twilio status-callback webhook
-- (/api/twilio/sms/status), keyed on external_id = Twilio MessageSid.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS twilio_status          TEXT,
  ADD COLUMN IF NOT EXISTS delivery_error_code    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_error_message TEXT;

-- The status callback looks rows up by Twilio SID, so index it.
CREATE INDEX IF NOT EXISTS messages_external_id_idx ON messages (external_id);
