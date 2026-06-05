-- Email Campaigns
-- Send bulk marketing/transactional emails via Resend to client segments

CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'marketing', -- marketing, newsletter, followup, announcement

  -- Content
  subject TEXT NOT NULL,
  preview_text TEXT, -- shown in inbox preview
  body_html TEXT NOT NULL, -- rich HTML body
  body_text TEXT, -- plain-text fallback (auto-derived if blank)
  from_name TEXT, -- "Jane from ACME" (falls back to org name)
  reply_to TEXT, -- reply-to email address

  -- Targeting (mirrors sms_campaigns)
  target_segment TEXT NOT NULL DEFAULT 'all', -- all, leads, prospects, active, won, custom
  target_pipeline_stages TEXT[],
  target_tags TEXT[],
  exclude_tags TEXT[],
  exclude_unsubscribed BOOLEAN NOT NULL DEFAULT true,

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, sending, sent, failed

  -- Stats (updated after send)
  total_recipients INT NOT NULL DEFAULT 0,
  delivered_count  INT NOT NULL DEFAULT 0,
  failed_count     INT NOT NULL DEFAULT 0,
  open_count       INT NOT NULL DEFAULT 0,
  click_count      INT NOT NULL DEFAULT 0,
  unsubscribe_count INT NOT NULL DEFAULT 0,

  -- Meta
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  email TEXT NOT NULL,
  recipient_name TEXT,
  resend_email_id TEXT, -- Resend message ID for tracking

  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT, -- manual, complaint, bounce

  UNIQUE(organization_id, email)
);

-- Indexes
CREATE INDEX idx_email_campaigns_org ON email_campaigns(organization_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(organization_id, status);
CREATE INDEX idx_email_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX idx_email_campaign_recipients_org ON email_campaign_recipients(organization_id);
CREATE INDEX idx_email_unsubscribes_org ON email_unsubscribes(organization_id);
CREATE INDEX idx_email_unsubscribes_email ON email_unsubscribes(organization_id, email);

-- RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage email campaigns"
  ON email_campaigns FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can view email recipients"
  ON email_campaign_recipients FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can manage email unsubscribes"
  ON email_unsubscribes FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));
