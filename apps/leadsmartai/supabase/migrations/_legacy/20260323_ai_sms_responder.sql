-- AI SMS responder conversation storage

create table if not exists public.sms_conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  stage text not null default 'new', -- new | warm | hot
  last_ai_reply_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_conversations_lead_id on public.sms_conversations(lead_id);
create index if not exists idx_sms_conversations_last_ai_reply_at
  on public.sms_conversations(last_ai_reply_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sms_conversations'
      and column_name = 'stage'
  ) then
    -- Ensure stage is valid; if the constraint exists already, ignore.
    if not exists (
      select 1
      from pg_constraint
      where conname = 'sms_conversations_stage_check'
    ) then
      alter table public.sms_conversations
        add constraint sms_conversations_stage_check
          check (lower(stage) in ('new','warm','hot'));
    end if;
  end if;
end $$;

