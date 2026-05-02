-- Lead queue: drop NOT NULL on contacts.agent_id + add claimed_at.
--
-- The lead-queue feature has been silently broken since the
-- contacts-consolidation migration tightened agent_id to NOT NULL.
-- The queue API at /api/dashboard/lead-queue filters on
-- `agent_id IS NULL` (only unowned leads belong in the queue) and the
-- claim endpoint atomically updates `agent_id` + `claimed_at` — so
-- with the column NOT NULL no row could ever land in the queue, and
-- every claim attempt would 500 on the missing claimed_at column.
--
-- Two additive changes that fix it without touching any existing row:
--   1) DROP NOT NULL on agent_id — unclaimed leads can sit unowned
--   2) ADD claimed_at TIMESTAMPTZ — claim writes the timestamp atomically
-- Plus a partial index on the unowned subset so the queue listing
-- stays fast as historical claimed leads accumulate.
--
-- Already applied to prod via Supabase MCP — this file checks the
-- change into source control alongside the writer change in
-- propertytoolsai's home-value flow that stops pre-assigning agents.

alter table public.contacts
  alter column agent_id drop not null;

alter table public.contacts
  add column if not exists claimed_at timestamptz;

create index if not exists idx_contacts_unowned_queue
  on public.contacts (created_at desc)
  where agent_id is null;

comment on column public.contacts.agent_id is
  'Owning agent. NULL = unclaimed lead sitting in the shared lead queue. Set atomically by /api/dashboard/lead-queue/claim when an agent claims the lead.';
comment on column public.contacts.claimed_at is
  'Timestamp when an agent claimed this lead from the queue. NULL for leads that were created already-owned (e.g. agent-created contacts).';
