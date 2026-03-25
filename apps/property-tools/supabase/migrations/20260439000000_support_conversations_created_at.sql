-- Align older support_chat deployments with PropertyTools dashboard queries.
-- Error without this: 42703 column "created_at" does not exist

alter table if exists public.support_conversations
  add column if not exists created_at timestamptz;

update public.support_conversations
set created_at = coalesce(last_message_at, updated_at, now())
where created_at is null;

alter table if exists public.support_conversations
  alter column created_at set default now();

alter table if exists public.support_conversations
  alter column created_at set not null;

create index if not exists idx_support_conversations_created_at
  on public.support_conversations (created_at desc);
