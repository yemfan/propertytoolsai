-- Twilio SMS integration support (phone_number + sms_opt_in + message_logs received/content)

-- =========================
-- LEADS: phone_number + sms_opt_in
-- =========================
alter table if exists public.leads
  add column if not exists phone_number text,
  add column if not exists sms_opt_in boolean not null default false;

-- Best-effort backfill phone_number from phone if present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='leads' and column_name='phone'
  ) then
    update public.leads
      set phone_number = phone
    where phone_number is null
      and phone is not null;
  end if;
end $$;

create index if not exists idx_leads_phone_number on public.leads(phone_number);
create index if not exists idx_leads_sms_opt_in on public.leads(sms_opt_in);

-- =========================
-- MESSAGE_LOGS: content + received
-- =========================
alter table if exists public.message_logs
  add column if not exists content text;

-- Expand status enum-like check constraint to include 'received'.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'message_logs_status_check') then
    alter table public.message_logs drop constraint message_logs_status_check;
  end if;
end $$;

alter table if exists public.message_logs
  add constraint message_logs_status_check check (status in ('sent', 'opened', 'clicked', 'replied', 'received'));

create index if not exists idx_message_logs_type_status_created_at
  on public.message_logs(type, status, created_at desc);

