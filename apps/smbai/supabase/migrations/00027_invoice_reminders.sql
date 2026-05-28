-- Week 34: invoice payment reminders (dunning).
-- Track when an invoice was last reminded and how many reminders have gone
-- out, so the cron doesn't re-send daily and the email tone can escalate.

alter table invoices
  add column if not exists last_reminder_sent_at timestamptz,
  add column if not exists reminder_count int not null default 0;
