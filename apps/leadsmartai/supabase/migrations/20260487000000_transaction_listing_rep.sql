-- Listing-rep support for the Transaction Coordinator.
--
-- The buyer-rep MVP anchors all task offsets on `mutual_acceptance_date`.
-- Listing-side work has an earlier anchor — the day the RLA (Residential
-- Listing Agreement) is signed — for pre-list and active-marketing tasks.
-- Post-offer tasks still anchor on `mutual_acceptance_date`.
--
-- So we add `listing_start_date` as an optional second anchor. Buyer-rep
-- deals leave it null; listing-rep deals populate it at create time.
-- Dual-agency and future listing-rep-only flows both benefit.
--
-- Idempotent: safe to re-run.

alter table public.transactions
  add column if not exists listing_start_date date;

comment on column public.transactions.listing_start_date is
  'RLA signed / listing active date. Anchor for listing-rep seed tasks in the pre-list + active-marketing stages. Null for buyer-rep deals.';
