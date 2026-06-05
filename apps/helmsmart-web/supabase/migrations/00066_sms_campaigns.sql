-- SMS Marketing Campaigns
-- Allows Emily (Marketing) to create and send SMS campaigns to client segments

CREATE TABLE sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Campaign metadata
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT DEFAULT 'promotional', -- promotional, transactional, reminder, nurture

  -- Message content
  template_id UUID REFERENCES sms_templates(id) ON DELETE SET NULL,
  message_text TEXT NOT NULL,
  short_url TEXT, -- Shortened tracking URL if included

  -- Targeting/segmentation
  target_segment TEXT NOT NULL, -- all, leads, prospects, active, won, custom
  target_pipeline_stages TEXT[], -- Array of stages if segment=custom
  target_tags TEXT[], -- Array of tags to include
  exclude_tags TEXT[], -- Array of tags to exclude
  exclude_unsubscribed BOOLEAN DEFAULT true,
  exclude_recent_hours INT DEFAULT 24, -- Don't message same person within N hours

  -- Scheduling
  scheduled_for TIMESTAMP, -- NULL = send immediately
  sent_at TIMESTAMP,
  status TEXT DEFAULT 'draft', -- draft, scheduled, sending, sent, failed

  -- Stats
  total_recipients INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  unsubscribe_count INT DEFAULT 0,
  click_count INT DEFAULT 0,

  -- Tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  message_text TEXT NOT NULL,
  category TEXT, -- follow_up, promotion, reminder, nurture, educational

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, name)
);

CREATE TABLE sms_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  phone_number TEXT NOT NULL,
  recipient_name TEXT,
  recipient_email TEXT,

  -- Delivery tracking
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT,

  -- Engagement
  clicked_at TIMESTAMP,
  unsubscribed_at TIMESTAMP,
  bounce_reason TEXT,

  -- Metadata
  twilio_sid TEXT, -- Twilio message SID for tracking
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sms_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,

  unsubscribed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT, -- manual, bounce, complaint, etc.

  UNIQUE(organization_id, phone_number)
);

-- Indexes for common queries
CREATE INDEX idx_sms_campaigns_org ON sms_campaigns(organization_id);
CREATE INDEX idx_sms_campaigns_status ON sms_campaigns(status, scheduled_for);
CREATE INDEX idx_sms_campaigns_created ON sms_campaigns(created_at DESC);
CREATE INDEX idx_sms_templates_org ON sms_templates(organization_id);
CREATE INDEX idx_sms_recipients_campaign ON sms_campaign_recipients(campaign_id);
CREATE INDEX idx_sms_recipients_org ON sms_campaign_recipients(organization_id);
CREATE INDEX idx_sms_recipients_client ON sms_campaign_recipients(client_id);
CREATE INDEX idx_sms_recipients_status ON sms_campaign_recipients(sent_at, failed_at);
CREATE INDEX idx_sms_unsubscribes_org ON sms_unsubscribes(organization_id);
CREATE INDEX idx_sms_unsubscribes_phone ON sms_unsubscribes(organization_id, phone_number);

-- RLS policies
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_campaigns" ON sms_campaigns
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM auth.organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_access_templates" ON sms_templates
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM auth.organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_access_recipients" ON sms_campaign_recipients
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM auth.organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_access_unsubscribes" ON sms_unsubscribes
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM auth.organization_members
    WHERE user_id = auth.uid()
  ));
