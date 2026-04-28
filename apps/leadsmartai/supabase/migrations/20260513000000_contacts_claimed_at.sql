-- Re-add claimed_at to public.contacts.
--
-- The original lead-queue migration (20260474000000_lead_queue.sql)
-- added `claimed_at timestamptz` to the now-defunct `public.leads`
-- table. The leads → contacts consolidation
-- (20260480100000_contacts_consolidation_create.sql) didn't carry that
-- column over, but the two write paths
--   * /api/dashboard/lead-queue/claim    (agent claims an unassigned lead)
--   * /api/admin/lead-queue/assign       (support staff assigns to an agent)
-- still stamp it. Without this column the writes fail with
-- "Could not find the 'claimed_at' column of 'contacts' in the schema
-- cache" and the lead never gets claimed.
--
-- Field semantics: timestamp the contact was first claimed from the
-- unassigned pool (where agent_id IS NULL). One-shot — once a lead is
-- claimed, claimed_at stays put; subsequent reassignments DON'T update
-- it (those routes filter on `is agent_id null` so the row is no
-- longer eligible anyway).

alter table public.contacts
  add column if not exists claimed_at timestamptz;

comment on column public.contacts.claimed_at is
  'Timestamp the lead was claimed from the unassigned pool (agent_id IS NULL). Set by /api/dashboard/lead-queue/claim and /api/admin/lead-queue/assign. One-shot — never updated after the initial claim.';

-- Partial index supports a future "recently claimed" admin query
-- without scanning all of contacts. Tiny on the partial filter so
-- the cost of carrying it is negligible.
create index if not exists idx_contacts_claimed_at
  on public.contacts (claimed_at desc)
  where claimed_at is not null;
