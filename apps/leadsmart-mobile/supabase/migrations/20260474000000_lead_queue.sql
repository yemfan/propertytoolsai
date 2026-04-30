-- Lead queue: all externally captured leads enter a shared pool (agent_id IS NULL).
-- Agents claim leads for free; support staff can assign.

-- Track when a lead was claimed from the queue.
alter table public.leads
  add column if not exists claimed_at timestamptz;

-- Allow 'new_lead' notification type in agent inbox.
alter table public.agent_inbox_notifications
  drop constraint if exists agent_inbox_notifications_type_chk;

alter table public.agent_inbox_notifications
  add constraint agent_inbox_notifications_type_chk
    check (type in ('hot_lead', 'missed_call', 'reminder', 'new_lead'));

-- Index for fast queue queries (unclaimed leads).
create index if not exists idx_leads_queue_unclaimed
  on public.leads (created_at desc)
  where agent_id is null;
