-- CRM conversation threads. lead_id is text (no FK) — compatible with bigint or uuid public.leads.id.

create table if not exists public.lead_conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  channel text not null default 'email',
  subject text null,
  message text not null,
  sender_name text null,
  sender_email text null,
  recipient_name text null,
  recipient_email text null,
  status text not null default 'sent',
  related_followup_id uuid null,
  created_at timestamptz not null default now()
);
