-- Align `contacts.rating` check constraint with the values the app
-- actually writes. The original constraint (from
-- 20260480100000_contacts_consolidation_create.sql) restricted rating
-- to A/B/C/D/unrated, but the dashboard UI, intake pipeline, and ~25
-- other code paths have all standardized on hot/warm/cold. Result:
-- every manual contact intake hit `contacts_rating_check` and surfaced
-- as a generic "Server error" to the user.
--
-- Drop the legacy constraint and replace it with one that matches
-- the live values. Allowing null preserves the "no rating yet" state
-- that the UI renders as "—".

alter table public.contacts
  drop constraint if exists contacts_rating_check;

alter table public.contacts
  add constraint contacts_rating_check
  check (rating is null or rating in ('hot', 'warm', 'cold'));
