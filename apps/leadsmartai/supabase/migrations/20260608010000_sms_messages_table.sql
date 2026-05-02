-- sms_messages — per-contact SMS thread.
--
-- Referenced (without ever being created in prod) by:
--   • lib/ai-sms/outbound.ts → sendOutboundSms() — writes outbound rows
--   • app/api/dashboard/leads/[id]/sms-conversation/route.ts — reads thread
--   • app/api/webhooks/twilio-sms/route.ts (Auto Pilot path) — writes inbound + outbound
--   • components/dashboard/AiChatPanel.tsx (new) — renders the thread
--
-- Schema inferred from existing call sites; columns used by callers
-- but unknown to other readers are left nullable so we don't break
-- partial writers.

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id bigint references public.agents(id) on delete set null,
  message text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  external_message_id text,
  twilio_status text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_messages_contact_created
  on public.sms_messages(contact_id, created_at desc);

create index if not exists idx_sms_messages_agent_created
  on public.sms_messages(agent_id, created_at desc)
  where agent_id is not null;

alter table public.sms_messages enable row level security;

drop policy if exists "sms_messages_select_own" on public.sms_messages;
create policy "sms_messages_select_own" on public.sms_messages
  for select using (
    exists (
      select 1 from public.contacts c
      join public.agents a on a.id = c.agent_id
      where c.id = sms_messages.contact_id
        and a.auth_user_id = auth.uid()
    )
  );

comment on table public.sms_messages is
  'Per-contact SMS thread. Service-role writes by webhook + outbound sender; agents read via RLS.';
