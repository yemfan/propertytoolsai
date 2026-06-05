-- Invoice reminder settings per org
-- Controls the dunning cron behavior

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS auto_send_reminders BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_days_intervals INTEGER[] NOT NULL DEFAULT '{3,7,14,30}',
  ADD COLUMN IF NOT EXISTS reminder_max_count INTEGER NOT NULL DEFAULT 4;
-- reminder_days_intervals: send a reminder when invoice is overdue by these many days
-- reminder_max_count: stop after this many reminders total per invoice
