-- Slack Integration
-- Stores Slack incoming webhook URL per organization
-- No OAuth required — users paste the webhook URL from their Slack app

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slack_notify_new_lead BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slack_notify_approval BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slack_notify_missed_call BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slack_notify_form_submission BOOLEAN NOT NULL DEFAULT true;
