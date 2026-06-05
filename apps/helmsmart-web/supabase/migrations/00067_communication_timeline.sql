-- Client Communication Timeline
-- Unified log of all client interactions: calls, SMS, emails, notes, appointments

CREATE TABLE communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Communication metadata
  type TEXT NOT NULL, -- call, sms, email, note, appointment, other
  direction TEXT, -- inbound, outbound (null for notes/appointments)
  status TEXT, -- pending, sent, delivered, failed, completed (for calls/sms)

  -- Content
  body TEXT, -- Message body for SMS/email/notes
  subject TEXT, -- Email subject or title for notes
  duration_seconds INT, -- Call duration
  call_recording_url TEXT, -- Twilio recording URL

  -- Sender/receiver info
  from_phone_number TEXT,
  from_email TEXT,
  to_phone_number TEXT,
  to_email TEXT,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- User if manual
  from_ai_employee_id UUID REFERENCES ai_employees(id) ON DELETE SET NULL, -- AI if autonomous

  -- External IDs for tracking
  twilio_call_sid TEXT, -- Twilio call SID
  twilio_message_sid TEXT, -- Twilio message SID
  email_message_id TEXT, -- Email message ID
  appointment_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- Sentiment & context (optional AI analysis)
  sentiment TEXT, -- positive, neutral, negative
  ai_summary TEXT, -- Auto-generated summary from Claude

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE communication_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Opt-outs
  opted_out_sms BOOLEAN DEFAULT false,
  opted_out_email BOOLEAN DEFAULT false,
  opted_out_calls BOOLEAN DEFAULT false,

  -- Preferences
  preferred_contact_method TEXT, -- sms, email, call, any
  best_time_to_contact TEXT, -- morning, afternoon, evening, weekdays, weekends
  notes TEXT, -- e.g., "prefers email after 5pm"

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, client_id)
);

-- Indexes for common queries
CREATE INDEX idx_communication_logs_org ON communication_logs(organization_id);
CREATE INDEX idx_communication_logs_client ON communication_logs(client_id);
CREATE INDEX idx_communication_logs_type ON communication_logs(type);
CREATE INDEX idx_communication_logs_created ON communication_logs(created_at DESC);
CREATE INDEX idx_communication_logs_client_created ON communication_logs(client_id, created_at DESC);
CREATE INDEX idx_communication_logs_twilio_call ON communication_logs(twilio_call_sid);
CREATE INDEX idx_communication_logs_twilio_message ON communication_logs(twilio_message_sid);
CREATE INDEX idx_communication_preferences_org ON communication_preferences(organization_id);
CREATE INDEX idx_communication_preferences_client ON communication_preferences(client_id);

-- RLS policies
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_logs" ON communication_logs
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM auth.organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_access_prefs" ON communication_preferences
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM auth.organization_members
    WHERE user_id = auth.uid()
  ));
