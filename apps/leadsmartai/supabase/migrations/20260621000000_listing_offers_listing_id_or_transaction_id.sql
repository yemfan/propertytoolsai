-- listing_offers schema relaxation for the listings/transactions split.
--
-- Phase 1 (PR #368) added a nullable `listing_id` column to
-- listing_offers and backfilled it from the existing transaction_id.
-- Phase 2c (PR #371) introduced listing creation that doesn't spawn
-- a transaction at create-time, which means a fresh listing has
-- transaction_id = NULL — and any attempt to record a listing-side
-- offer against that listing would fail the existing NOT NULL
-- constraint on listing_offers.transaction_id.
--
-- This migration relaxes that:
--
--   1. Drop NOT NULL on listing_offers.transaction_id so listing-only
--      offers (Phase 2c+ flow) can land.
--
--   2. Add a CHECK constraint so at least one target is set —
--      otherwise a row with both columns NULL would represent a
--      dangling offer with no parent.
--
-- Rollback: alter the column back to NOT NULL after backfilling
-- transaction_id from the listings table (each listing's
-- transaction_id back-link). Drop the check constraint.

alter table public.listing_offers
  alter column transaction_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listing_offers_target_set'
  ) then
    alter table public.listing_offers
      add constraint listing_offers_target_set
      check (transaction_id is not null or listing_id is not null);
  end if;
end $$;

comment on column public.listing_offers.transaction_id is
  'Source transaction (legacy flow + post-acceptance listings). Nullable since Phase 2c — listings created without a transaction insert listing_offers with listing_id set instead. The CHECK constraint listing_offers_target_set enforces at least one of (transaction_id, listing_id) is non-null.';

comment on column public.listing_offers.listing_id is
  'Source listing (Phase 1+). Set on listing-side offers for listings that don''t have a back-linked transaction yet (pre-acceptance). Lifecycle promotion (Phase 2d) populates the back-linked transaction; this column stays pointing at the listing.';
