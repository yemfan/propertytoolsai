-- Auto Lead Nurturing System (lead_sequences -> sequence_steps -> message_logs)
-- Runs in parallel with existing tooling; cron + tracking endpoints will write to these tables.

-- =========================
-- Leads: nurture score
-- =========================
alter table if exists public.leads
  add column if not exists nurture_score int not null default 0;

create index if not exists idx_leads_nurture_score on public.leads(nurture_score desc);

-- =========================
-- Templates
-- =========================
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null, -- seller | buyer
  channel text not null,   -- email | sms
  template_text text not null,
  created_at timestamptz not null default now(),
  constraint message_templates_lead_type_channel_check
    check (lower(lead_type) in ('seller','buyer') and lower(channel) in ('email','sms'))
);

create index if not exists idx_message_templates_lead_type_channel
  on public.message_templates(lead_type, channel);

-- Seed 4 templates (safe to re-run)
do $$
begin
  if not exists (
    select 1 from public.message_templates
    where lower(lead_type) = 'seller' and lower(channel) = 'email'
  ) then
    insert into public.message_templates(lead_type, channel, template_text)
    values (
      'seller',
      'email',
      'Hi {name},{city ? " " + city : ""} quick follow-up on your home value request.\n\nYour estimated home value: {home_value}.\n\nIf you want, reply to this email and your agent ({agent_name}) will walk you through next steps for pricing and timing.\n\n— PropertyTools AI'
    );
  end if;

  if not exists (
    select 1 from public.message_templates
    where lower(lead_type) = 'seller' and lower(channel) = 'sms'
  ) then
    insert into public.message_templates(lead_type, channel, template_text)
    values (
      'seller',
      'sms',
      'Hi {name} — quick follow-up from PropertyTools AI. Est. home value in {city}: {home_value}. Reply if you want {agent_name} to help with pricing.'
    );
  end if;

  if not exists (
    select 1 from public.message_templates
    where lower(lead_type) = 'buyer' and lower(channel) = 'email'
  ) then
    insert into public.message_templates(lead_type, channel, template_text)
    values (
      'buyer',
      'email',
      'Hi {name},\n\nThanks for requesting your mortgage rate estimate. Based on your address, here’s your current monthly target: {home_value}.\n\nWant a lender-ready next step? Reply to this email and {agent_name} will reach out with a quick plan.\n\n— PropertyTools AI'
    );
  end if;

  if not exists (
    select 1 from public.message_templates
    where lower(lead_type) = 'buyer' and lower(channel) = 'sms'
  ) then
    insert into public.message_templates(lead_type, channel, template_text)
    values (
      'buyer',
      'sms',
      'Hi {name} — mortgage update from PropertyTools AI. Est. monthly target: {home_value}. Reply if you want {agent_name} to help with next steps.'
    );
  end if;
end $$;

-- =========================
-- Lead sequences (per lead)
-- =========================
create table if not exists public.lead_sequences (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null,
  current_step int not null default 0,
  status text not null default 'active', -- active | paused | completed
  next_send_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint lead_sequences_status_check check (status in ('active','paused','completed'))
);

-- One active sequence per lead (we still allow completed history by updating in-place).
create unique index if not exists idx_lead_sequences_unique_lead_id on public.lead_sequences(lead_id);

create index if not exists idx_lead_sequences_status_next_send_at
  on public.lead_sequences(status, next_send_at);

-- =========================
-- Sequence steps (per sequence)
-- =========================
create table if not exists public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.lead_sequences(id) on delete cascade,
  day_offset int not null default 0, -- days after lead.created_at
  channel text not null,             -- email | sms
  template_id uuid not null references public.message_templates(id) on delete restrict,
  sent boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sequence_steps_channel_check check (lower(channel) in ('email','sms'))
);

create index if not exists idx_sequence_steps_sequence_id_sent
  on public.sequence_steps(sequence_id, sent);

create unique index if not exists idx_sequence_steps_unique_order
  on public.sequence_steps(sequence_id, day_offset, channel);

-- =========================
-- Message logs
-- =========================
create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null,
  type text not null, -- email | sms
  status text not null, -- sent | opened | clicked | replied
  created_at timestamptz not null default now(),
  constraint message_logs_type_check check (lower(type) in ('email','sms')),
  constraint message_logs_status_check check (status in ('sent','opened','clicked','replied'))
);

create index if not exists idx_message_logs_lead_id_created_at
  on public.message_logs(lead_id, created_at desc);

-- =========================
-- Helper: update nurture score + derive temperature rating
-- =========================
create or replace function public.marketplace_apply_nurture_score(
  p_lead_id bigint,
  p_delta int
)
returns jsonb
language plpgsql
as $$
declare
  v_new_score int;
  v_new_rating text;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'message', 'lead_id required');
  end if;

  update public.leads
    set nurture_score = greatest(0, nurture_score + coalesce(p_delta,0))
  where id = p_lead_id
  returning nurture_score into v_new_score;

  -- Temperature mapping:
  -- cold: <3, warm: 3-6, hot: >=7
  v_new_rating :=
    case
      when coalesce(v_new_score,0) >= 7 then 'hot'
      when coalesce(v_new_score,0) >= 3 then 'warm'
      else 'cold'
    end;

  update public.leads
    set rating = v_new_rating
  where id = p_lead_id;

  return jsonb_build_object('ok', true, 'new_score', v_new_score, 'rating', v_new_rating);
end;
$$;

-- =========================
-- Agent alerts
-- =========================
create table if not exists public.nurture_alerts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid,
  lead_id bigint not null,
  type text not null, -- hot | replied
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_nurture_alerts_agent_id_created_at
  on public.nurture_alerts(agent_id, created_at desc);
create index if not exists idx_nurture_alerts_lead_id_created_at
  on public.nurture_alerts(lead_id, created_at desc);

