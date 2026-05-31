-- Outbound AI calling. Distinguish AI-placed (outbound) calls from inbound
-- receptionist calls, and record why we called + who we called. Existing rows
-- are inbound (the receptionist answering), so default direction accordingly.

ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound';
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
