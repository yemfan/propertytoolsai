-- Base table for scheduled lead follow-ups (email/SMS sequences).
-- Prior migrations only ALTER'd this table; the CREATE was missing, which breaks fresh DBs.

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  assigned_agent_id text null,
  channel text not null,
  subject text null,
  message text not null,
  status text not null default 'pending',
  step_number int not null default 1,
  scheduled_for timestamptz not null,
  sequence_key text null,
  template_key text null,
  variant_key text null,
  recipient_name text null,
  recipient_email text null,
  recipient_phone text null,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_followups_lead_id on public.lead_followups (lead_id);
create index if not exists idx_lead_followups_assigned_scheduled
  on public.lead_followups (assigned_agent_id, scheduled_for asc);
create index if not exists idx_lead_followups_pending_scheduled
  on public.lead_followups (scheduled_for asc)
  where status = 'pending';

comment on table public.lead_followups is
  'Queued outbound follow-up steps (listing, home value, smart match, etc.).';
