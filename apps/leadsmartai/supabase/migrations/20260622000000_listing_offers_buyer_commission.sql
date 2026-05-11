-- Add buyer-side commission to listing_offers so sellers + listing
-- agents can see what the buyer is offering for commission as part
-- of the offer comparison.
--
-- This is the commission the buyer is offering to PAY on their
-- side (a.k.a. the buyer-broker compensation). It's negotiated as
-- part of the offer post-NAR-settlement and matters a lot to
-- sellers — a buyer offering 2% vs 3% changes the net-to-seller
-- materially.
--
-- Stored as a numeric percentage (e.g. 2.5 means 2.5%). Nullable
-- because not every buyer offers an explicit commission (some
-- defer to the listing's published rate).

alter table public.listing_offers
  add column if not exists buyer_commission_pct numeric;

comment on column public.listing_offers.buyer_commission_pct is
  'Buyer-side commission offered by the buyer, as a percentage (e.g. 2.5 = 2.5%). Used in offer comparison + net-to-seller calculations. Nullable.';
