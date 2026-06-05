-- Recurring email campaigns
-- A campaign with is_recurring=true acts as a template; the cron clones + sends
-- a copy each period and advances next_run_at.

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval TEXT,        -- weekly, monthly
  ADD COLUMN IF NOT EXISTS recurrence_day INT,              -- 0-6 for weekly (Sun=0), 1-28 for monthly
  ADD COLUMN IF NOT EXISTS recurrence_hour INT DEFAULT 9,   -- hour of day (UTC) to send
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_campaigns_recurring
  ON email_campaigns(is_recurring, next_run_at) WHERE is_recurring = true;
