-- Weekly seller-update email feature.
--
-- On active listing_rep / dual transactions, the listing agent can
-- enable a Monday-morning email to the seller summarizing activity
-- since the last report: open-house visitors, offers in, AI-generated
-- market commentary + recommendation.
--
-- Two columns on `transactions`:
--   * seller_update_enabled     — opt-in toggle. Default FALSE: emailing
--                                 sellers is a bigger action than emailing
--                                 agents, so agents must explicitly flip
--                                 this on per-listing.
--   * seller_update_last_sent_at — dedupe + report window anchor.
--                                 Next week's email covers activity
--                                 since this timestamp.
--
-- No separate log table — last-sent timestamp is the primary dedupe
-- signal (one email per week per listing; if Vercel retries, we won't
-- re-send because last-sent will be within the 6-day floor).

alter table public.transactions
  add column if not exists seller_update_enabled boolean not null default false;

alter table public.transactions
  add column if not exists seller_update_last_sent_at timestamptz;

comment on column public.transactions.seller_update_enabled is
  'Opt-in toggle for the Monday-morning seller update email. Only applicable to listing_rep / dual transactions; the cron skips buyer-rep regardless.';

comment on column public.transactions.seller_update_last_sent_at is
  'Timestamp of the most recent seller update sent. Cron uses this to dedupe (minimum 6 days between sends) and to determine the activity window for the next report.';

-- The cron query needs to scan active listings with the toggle on.
-- Partial index keeps this cheap — only matches rows that matter.
create index if not exists idx_transactions_seller_update_due
  on public.transactions (seller_update_last_sent_at nulls first)
  where seller_update_enabled = true
    and status in ('active', 'pending')
    and transaction_type in ('listing_rep', 'dual');
