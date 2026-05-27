-- 00008_voice_social.sql
-- Voice agent conversation sessions + Social media post queue.

-- ─── Voice agent org config ───────────────────────────────────────────────────

alter table organizations
  add column if not exists voice_agent_enabled  boolean not null default false,
  add column if not exists voice_agent_greeting text    not null default
    'Hello! Thank you for calling. How can I help you today?',
  add column if not exists voice_agent_prompt   text;

-- ─── Voice sessions (conversation state per call) ─────────────────────────────

create table if not exists voice_sessions (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  call_sid        text        not null unique,
  from_number     text        not null,
  to_number       text        not null,
  messages        jsonb       not null default '[]',
  booked_event_id uuid        references events(id) on delete set null,
  status          text        not null default 'active'
                              check (status in ('active', 'completed', 'failed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_voice_sessions_org
  on voice_sessions(organization_id, created_at desc);

alter table voice_sessions enable row level security;

create policy "members_select_voice_sessions" on voice_sessions
  for select using (organization_id in (select get_user_org_ids()));

-- ─── Social posts ─────────────────────────────────────────────────────────────

create table if not exists social_posts (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations(id) on delete cascade,

  platform          text        not null
                                check (platform in ('x', 'linkedin', 'facebook', 'instagram')),
  content           text        not null,

  status            text        not null default 'draft'
                                check (status in ('draft', 'scheduled', 'published', 'failed')),
  scheduled_at      timestamptz,
  published_at      timestamptz,
  published_url     text,
  media_url         text,

  generated_by_ai   boolean     not null default false,
  ai_prompt         text,
  tone              text        not null default 'professional'
                                check (tone in ('professional', 'casual', 'witty', 'promotional', 'educational')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_social_posts_org_status
  on social_posts(organization_id, status, scheduled_at desc);

alter table social_posts enable row level security;

create policy "members_select_social_posts" on social_posts
  for select using (organization_id in (select get_user_org_ids()));

create policy "members_insert_social_posts" on social_posts
  for insert with check (organization_id in (select get_user_org_ids()));

create policy "members_update_social_posts" on social_posts
  for update using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

create policy "members_delete_social_posts" on social_posts
  for delete using (organization_id in (select get_user_org_ids()));
