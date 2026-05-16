-- Annual renewal reminder tracking.
--
-- California (BPC §17602) and New York (GBL §527-a) require an
-- auto-renewal reminder for any subscription renewing more than one
-- year out, sent 15–45 days before renewal. We use the conservative
-- 30-day window so we sit comfortably inside both jurisdictions.
--
-- Tracking the "sent for this period" state needs to be idempotent —
-- the cron runs daily and we must not send 30 emails over 30 days.
-- Storing the timestamp on the subscription row itself avoids a new
-- table. Reset to NULL whenever `current_period_end` advances (the
-- webhook handler that processes `invoice.paid` for the renewal will
-- clear it).

alter table if exists public.subscriptions
  add column if not exists annual_renewal_reminder_sent_at timestamptz null;

comment on column public.subscriptions.annual_renewal_reminder_sent_at is
  'When the 30-day auto-renewal reminder was last sent for the current annual period. Cleared on each successful renewal so the next period gets its own reminder. NULL means no reminder sent for the current period yet (cron will send when current_period_end is ~30 days out).';

-- Partial index supports the cron query: find rows that are annual,
-- active, and haven't been reminded yet, with a renewal coming up.
create index if not exists idx_subscriptions_annual_renewal_due
  on public.subscriptions (current_period_end)
  where billing_cadence = 'annual'
    and annual_renewal_reminder_sent_at is null
    and status in ('active', 'trialing');
