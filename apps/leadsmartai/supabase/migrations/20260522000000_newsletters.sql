-- Newsletter / mass-email campaigns.
--
-- Closes the "newsletter / mass-email composer" gap. The agent
-- writes a campaign once (subject + body + recipient list) and the
-- system fans it out one Resend send per recipient, with per-
-- recipient personalization (Hi {{firstName}}, ...).
--
-- Two tables:
--   - newsletters: campaign metadata (one row per campaign)
--   - newsletter_recipients: per-recipient send state. Joins back
--     to email_events via external_message_id so opens/clicks
--     from #188 hang off the right campaign+recipient
--
-- agent_id type adapts to public.agents.id (uuid OR bigint).

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.newsletters (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        subject text not null default '',
        body_html text not null default '',
        body_text text not null default '',
        from_name text null,
        reply_to_email text null,
        status text not null default 'draft' check (status in (
          'draft','queued','sending','sent','failed','canceled'
        )),
        scheduled_at timestamptz null,
        sent_started_at timestamptz null,
        sent_completed_at timestamptz null,
        recipient_count int not null default 0,
        sent_count int not null default 0,
        failed_count int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.newsletter_recipients (
        id uuid primary key default gen_random_uuid(),
        newsletter_id uuid not null references public.newsletters(id) on delete cascade,
        contact_id uuid null,
        email text not null,
        first_name text null,
        last_name text null,
        status text not null default 'pending' check (status in (
          'pending','sent','failed','skipped','unsubscribed'
        )),
        external_message_id text null,
        sent_at timestamptz null,
        error_message text null,
        created_at timestamptz not null default now(),
        unique (newsletter_id, email)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.newsletters (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        subject text not null default '',
        body_html text not null default '',
        body_text text not null default '',
        from_name text null,
        reply_to_email text null,
        status text not null default 'draft' check (status in (
          'draft','queued','sending','sent','failed','canceled'
        )),
        scheduled_at timestamptz null,
        sent_started_at timestamptz null,
        sent_completed_at timestamptz null,
        recipient_count int not null default 0,
        sent_count int not null default 0,
        failed_count int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.newsletter_recipients (
        id uuid primary key default gen_random_uuid(),
        newsletter_id uuid not null references public.newsletters(id) on delete cascade,
        contact_id uuid null,
        email text not null,
        first_name text null,
        last_name text null,
        status text not null default 'pending' check (status in (
          'pending','sent','failed','skipped','unsubscribed'
        )),
        external_message_id text null,
        sent_at timestamptz null,
        error_message text null,
        created_at timestamptz not null default now(),
        unique (newsletter_id, email)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.newsletters is
  'Mass-email campaigns. One row per campaign; fanout is one Resend send per newsletter_recipients row.';

comment on column public.newsletter_recipients.external_message_id is
  'Resend message id from the per-recipient send. Joins to email_events so opens/clicks from PR-Z1 attribute back to this campaign + recipient.';

-- ── triggers ────────────────────────────────────────────────────

create or replace function public.set_newsletters_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletters_set_updated_at on public.newsletters;
create trigger newsletters_set_updated_at
  before update on public.newsletters
  for each row execute procedure public.set_newsletters_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_newsletters_agent_status
  on public.newsletters (agent_id, status, created_at desc);

create index if not exists idx_newsletter_recipients_newsletter_status
  on public.newsletter_recipients (newsletter_id, status);

create index if not exists idx_newsletter_recipients_external_id
  on public.newsletter_recipients (external_message_id)
  where external_message_id is not null;

create index if not exists idx_newsletter_recipients_contact
  on public.newsletter_recipients (contact_id)
  where contact_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.newsletters enable row level security;
alter table public.newsletter_recipients enable row level security;

drop policy if exists "newsletters_select_own" on public.newsletters;
create policy "newsletters_select_own"
  on public.newsletters
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = newsletters.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "newsletters_insert_own" on public.newsletters;
create policy "newsletters_insert_own"
  on public.newsletters
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = newsletters.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "newsletters_update_own" on public.newsletters;
create policy "newsletters_update_own"
  on public.newsletters
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = newsletters.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = newsletters.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "newsletter_recipients_select_own" on public.newsletter_recipients;
create policy "newsletter_recipients_select_own"
  on public.newsletter_recipients
  for select
  using (
    exists (
      select 1 from public.newsletters n
      join public.agents a on a.id = n.agent_id
      where n.id = newsletter_recipients.newsletter_id
        and a.auth_user_id = auth.uid()
    )
  );
