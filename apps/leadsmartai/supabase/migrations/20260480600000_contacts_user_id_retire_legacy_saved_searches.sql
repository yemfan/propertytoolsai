-- contacts.user_id + retire lead_saved_searches.
--
-- Phase B2 prereq. Adds the auth.users linkage so propertytoolsai's
-- consumer side can resolve the logged-in user to their contact row,
-- and drops the legacy lead_saved_searches table that was written to
-- by /api/match/save-search (now retired — replaced by the unified
-- contact_saved_searches + /api/consumer/saved-searches).

-- Add user_id FK back (was on legacy leads, lost in consolidation).
-- on delete set null: if a user deletes their auth account, the
-- contact row stays (agent still owns the data / compliance audit
-- trail), just detached from the account.
alter table public.contacts
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_contacts_user_id
  on public.contacts(user_id)
  where user_id is not null;

-- Retire legacy table. Pre-release / basically-no-data so drop is safe.
-- No backfill into contact_saved_searches because the old rows were
-- keyed on lead_id (bigint) which no longer exists, and the shape of
-- its `preferences` jsonb doesn't cleanly map to SavedSearchCriteria.
drop table if exists public.lead_saved_searches cascade;
