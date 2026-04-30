-- Sphere module (§2.6): past-client + sphere contact book with equity tracking,
-- life-event signals, and per-contact trigger toggles.
--
-- IMPORTANT — these tables are based on the [ASSUMED] schema in the sphere
-- prototype. Spec §2.3 was empty in the source docx. Before this migration
-- is applied to production, PM must sign off on the fields. Compliance
-- fields (tcpa_log, consent_date, consent_source) are intentionally NOT
-- here yet — the prototype flagged them as "probably needed before real
-- build". Add them in a follow-up migration once legal reviews §2.8.
--
-- Spec refs: §2.3 (data model — EMPTY in source), §2.4 (trigger library —
-- EMPTY in source; thresholds are guesses), §2.6 (UI surfaces), §2.8
-- (compliance — needs legal review).

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'agents' and a.attname = 'id'
    and a.attnum > 0 and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.sphere_contacts (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        first_name text not null,
        last_name text null,
        email text null,
        phone text null,
        avatar_color text null,
        address text null,
        closing_address text null,
        closing_date date null,
        closing_price numeric null,
        avm_current numeric null,
        avm_updated_at timestamptz null,
        relationship_type text not null default 'sphere_non_client'
          check (relationship_type in (
            'past_buyer_client', 'past_seller_client',
            'sphere_non_client', 'referral_source'
          )),
        relationship_tag text null,
        anniversary_opt_in boolean not null default false,
        preferred_language text not null default 'en'
          check (preferred_language in ('en', 'zh')),
        last_touch_date timestamptz null,
        do_not_contact_sms boolean not null default false,
        do_not_contact_email boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.sphere_contacts (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        first_name text not null,
        last_name text null,
        email text null,
        phone text null,
        avatar_color text null,
        address text null,
        closing_address text null,
        closing_date date null,
        closing_price numeric null,
        avm_current numeric null,
        avm_updated_at timestamptz null,
        relationship_type text not null default 'sphere_non_client'
          check (relationship_type in (
            'past_buyer_client', 'past_seller_client',
            'sphere_non_client', 'referral_source'
          )),
        relationship_tag text null,
        anniversary_opt_in boolean not null default false,
        preferred_language text not null default 'en'
          check (preferred_language in ('en', 'zh')),
        last_touch_date timestamptz null,
        do_not_contact_sms boolean not null default false,
        do_not_contact_email boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for sphere_contacts: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_sphere_contacts_agent
  on public.sphere_contacts(agent_id);
create index if not exists idx_sphere_contacts_agent_last_touch
  on public.sphere_contacts(agent_id, last_touch_date);
create index if not exists idx_sphere_contacts_agent_rel
  on public.sphere_contacts(agent_id, relationship_type);

-- Life-event signals (refi detected, job change, equity milestone crossed…).
-- Spec §2.6.3: signals surface as calling-list items only — never auto-send.
create table if not exists public.sphere_signals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.sphere_contacts(id) on delete cascade,
  signal_type text not null
    check (signal_type in (
      'equity_milestone', 'refi_detected', 'job_change',
      'dormant', 'life_event_other', 'comparable_sale'
    )),
  label text not null,
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  suggested_action text null,
  payload jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  dismissed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sphere_signals_contact
  on public.sphere_signals(contact_id);
create index if not exists idx_sphere_signals_open
  on public.sphere_signals(contact_id)
  where dismissed_at is null;

-- Per-contact template trigger toggles. Overrides agent-level review policy
-- and template_overrides for this specific contact. Null = inherit.
create table if not exists public.sphere_contact_triggers (
  contact_id uuid not null references public.sphere_contacts(id) on delete cascade,
  template_id text not null references public.templates(id) on delete cascade,
  enabled boolean not null default true,
  status_override text null
    check (status_override is null or status_override in ('autosend', 'review', 'off')),
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (contact_id, template_id)
);

create index if not exists idx_sphere_contact_triggers_template
  on public.sphere_contact_triggers(template_id);

comment on table public.sphere_contacts is
  '[ASSUMED SCHEMA] Per spec §2.3 (empty in source). Past-client + sphere contact book with equity tracking. TCPA log/consent trail pending §2.8 legal review.';
comment on table public.sphere_signals is
  'Life-event signals (equity milestones, refi, job change). Spec §2.6.3: never auto-send — calling-list items only.';
comment on table public.sphere_contact_triggers is
  'Per-contact template trigger toggles. Null = inherit agent-level template_overrides.';
