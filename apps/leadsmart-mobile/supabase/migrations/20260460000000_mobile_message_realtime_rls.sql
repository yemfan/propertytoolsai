-- RLS + realtime for LeadSmart mobile: agents read message rows only for their leads.
-- Service role (server) bypasses RLS. Authenticated users (JWT) use policies below.

alter table if exists public.sms_messages enable row level security;
alter table if exists public.email_messages enable row level security;
alter table if exists public.sms_conversations enable row level security;

drop policy if exists "sms_messages_select_own_agent_leads" on public.sms_messages;
create policy "sms_messages_select_own_agent_leads"
  on public.sms_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      inner join public.agents a on a.id = l.agent_id
      where l.id = sms_messages.lead_id
        and a.auth_user_id = auth.uid()
    )
  );

drop policy if exists "email_messages_select_own_agent_leads" on public.email_messages;
create policy "email_messages_select_own_agent_leads"
  on public.email_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      inner join public.agents a on a.id = l.agent_id
      where l.id = email_messages.lead_id
        and a.auth_user_id = auth.uid()
    )
  );

drop policy if exists "sms_conversations_select_own_agent_leads" on public.sms_conversations;
create policy "sms_conversations_select_own_agent_leads"
  on public.sms_conversations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      inner join public.agents a on a.id = l.agent_id
      where l.id = sms_conversations.lead_id
        and a.auth_user_id = auth.uid()
    )
  );

-- Broadcast changes to authenticated subscribers (RLS filters events per user).
do $$
begin
  alter publication supabase_realtime add table public.sms_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.email_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.sms_conversations;
exception
  when duplicate_object then null;
end $$;
