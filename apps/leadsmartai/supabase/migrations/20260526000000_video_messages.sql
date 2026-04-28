-- Video email messages.
--
-- Closes the "video email / video messaging" gap from the
-- analysis. The agent records a short video (browser
-- MediaRecorder), uploads to storage, and emails a thumbnail
-- linking to a public player page. View analytics flow back so
-- the agent can see "Bob watched 70% of your follow-up video".
--
-- This migration is the data foundation. Browser recording UI
-- and the storage upload pipeline ship in follow-up PRs.
--
-- Two tables:
--   - video_messages: one row per recorded video. Token-gated
--     public view URL at /v/[token]
--   - video_message_views: append-only view log (one row per
--     play). Ip hashed for privacy; watch_pct (0-100) lets the
--     dashboard show "watched 70%" instead of just a play count
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
      create table if not exists public.video_messages (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        title text not null default '',
        video_url text not null,
        thumbnail_url text null,
        duration_seconds int not null default 0 check (duration_seconds >= 0),
        -- Hashed share token. Raw token only ever leaves the
        -- server in the embedded thumbnail link.
        share_token_hash text not null unique,
        is_published boolean not null default true,
        view_count int not null default 0,
        unique_view_count int not null default 0,
        last_viewed_at timestamptz null,
        sent_to_email text null,
        sent_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.video_message_views (
        id uuid primary key default gen_random_uuid(),
        video_id uuid not null references public.video_messages(id) on delete cascade,
        -- SHA-256 hex of the viewer's IP. Lets us count unique
        -- viewers without storing raw IPs.
        ip_hash text null,
        user_agent text null,
        -- 0-100. Updates on the same view as the player
        -- progresses; final value is what we keep.
        watch_pct int not null default 0 check (watch_pct between 0 and 100),
        watched_seconds int not null default 0,
        occurred_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.video_messages (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        title text not null default '',
        video_url text not null,
        thumbnail_url text null,
        duration_seconds int not null default 0 check (duration_seconds >= 0),
        share_token_hash text not null unique,
        is_published boolean not null default true,
        view_count int not null default 0,
        unique_view_count int not null default 0,
        last_viewed_at timestamptz null,
        sent_to_email text null,
        sent_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.video_message_views (
        id uuid primary key default gen_random_uuid(),
        video_id uuid not null references public.video_messages(id) on delete cascade,
        ip_hash text null,
        user_agent text null,
        watch_pct int not null default 0 check (watch_pct between 0 and 100),
        watched_seconds int not null default 0,
        occurred_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.video_messages is
  'Agent-recorded video messages. Token-gated public viewer at /v/[token]; views persist to video_message_views for engagement analytics.';

comment on column public.video_messages.duration_seconds is
  'Total length of the video. Used to compute watch_pct from watched_seconds.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_video_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists video_messages_set_updated_at on public.video_messages;
create trigger video_messages_set_updated_at
  before update on public.video_messages
  for each row execute procedure public.set_video_messages_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_video_messages_agent_created
  on public.video_messages (agent_id, created_at desc);

create index if not exists idx_video_messages_contact
  on public.video_messages (contact_id)
  where contact_id is not null;

create index if not exists idx_video_message_views_video
  on public.video_message_views (video_id, occurred_at desc);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.video_messages enable row level security;
alter table public.video_message_views enable row level security;

drop policy if exists "video_messages_select_own" on public.video_messages;
create policy "video_messages_select_own"
  on public.video_messages
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "video_messages_insert_own" on public.video_messages;
create policy "video_messages_insert_own"
  on public.video_messages
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "video_messages_update_own" on public.video_messages;
create policy "video_messages_update_own"
  on public.video_messages
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "video_messages_delete_own" on public.video_messages;
create policy "video_messages_delete_own"
  on public.video_messages
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = video_messages.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

-- Views: agents can read views for their own videos.
drop policy if exists "video_message_views_select_own" on public.video_message_views;
create policy "video_message_views_select_own"
  on public.video_message_views
  for select
  using (
    exists (
      select 1 from public.video_messages v
      join public.agents a on a.id = v.agent_id
      where v.id = video_message_views.video_id
        and a.auth_user_id = auth.uid()
    )
  );
