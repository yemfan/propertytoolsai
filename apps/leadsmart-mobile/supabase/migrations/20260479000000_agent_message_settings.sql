-- Per-agent message policy (review/autosend), timing rules (quiet hours, frequency caps),
-- and the real-estate-specific compliance flags (Sunday morning, Chinese New Year).
-- Paired with the Dashboard Settings "Messages" tab.
--
-- Spec refs:
--   §2.4 (review policy + 30-day draft-only window)
--   §2.8 (quiet hours, per-contact caps, bilingual holiday pauses)

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.agent_message_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,

        -- Review policy (§2.4)
        review_policy text not null default 'review'
          check (review_policy in ('review', 'autosend', 'per_category')),
        review_policy_by_category jsonb not null default jsonb_build_object(
          'sphere', 'review',
          'lead_response', 'review'
        ),

        -- Timing (§2.8)
        quiet_hours_start time not null default '21:00',
        quiet_hours_end   time not null default '08:00',
        use_contact_timezone boolean not null default true,
        no_sunday_morning    boolean not null default true,
        pause_chinese_new_year boolean not null default true,

        max_per_contact_per_day integer not null default 2
          check (max_per_contact_per_day between 1 and 5),
        pause_on_reply_days integer not null default 7
          check (pause_on_reply_days between 0 and 30),

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_message_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        review_policy text not null default 'review'
          check (review_policy in ('review', 'autosend', 'per_category')),
        review_policy_by_category jsonb not null default jsonb_build_object(
          'sphere', 'review',
          'lead_response', 'review'
        ),
        quiet_hours_start time not null default '21:00',
        quiet_hours_end   time not null default '08:00',
        use_contact_timezone boolean not null default true,
        no_sunday_morning    boolean not null default true,
        pause_chinese_new_year boolean not null default true,
        max_per_contact_per_day integer not null default 2
          check (max_per_contact_per_day between 1 and 5),
        pause_on_reply_days integer not null default 7
          check (pause_on_reply_days between 0 and 30),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_message_settings: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_agent_message_settings_agent
  on public.agent_message_settings(agent_id);

-- Spec §2.4: in the first 30 days of an account, the effective review_policy
-- must always be 'review' regardless of the stored value. Enforce at the DB
-- layer so API bugs can't accidentally bypass the gate. This view is what
-- the trigger scheduler should read from; the raw table is only for the UI.
create or replace view public.agent_message_settings_effective as
select
  s.id,
  s.agent_id,
  case
    when a.created_at is null then 'review'
    when a.created_at > (now() - interval '30 days') then 'review'
    else s.review_policy
  end as effective_review_policy,
  case
    when a.created_at is null then jsonb_build_object('sphere', 'review', 'lead_response', 'review')
    when a.created_at > (now() - interval '30 days') then jsonb_build_object('sphere', 'review', 'lead_response', 'review')
    else s.review_policy_by_category
  end as effective_review_policy_by_category,
  s.review_policy as stored_review_policy,
  s.review_policy_by_category as stored_review_policy_by_category,
  (a.created_at > (now() - interval '30 days')) as onboarding_gate_active,
  s.quiet_hours_start,
  s.quiet_hours_end,
  s.use_contact_timezone,
  s.no_sunday_morning,
  s.pause_chinese_new_year,
  s.max_per_contact_per_day,
  s.pause_on_reply_days,
  a.created_at as agent_created_at,
  s.updated_at
from public.agent_message_settings s
join public.agents a on a.id = s.agent_id;

comment on table  public.agent_message_settings is
  'Per-agent message delivery policy (review/autosend), quiet hours, per-contact caps, and real-estate-specific pauses. See spec §2.4 + §2.8.';
comment on view   public.agent_message_settings_effective is
  'Effective policy with the spec §2.4 30-day draft-only window forced. Read from this view in the trigger scheduler, not from the raw table.';
comment on column public.agent_message_settings.review_policy is
  'Stored policy. Effective policy respects the 30-day onboarding gate — read agent_message_settings_effective.effective_review_policy.';
