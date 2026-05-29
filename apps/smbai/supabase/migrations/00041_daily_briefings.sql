-- ============================================================
-- Migration 00041: Daily briefing cache
-- ============================================================
-- Caches the AI-written "what needs you today" briefing once per org per day,
-- so the dashboard renders it fast and the wording stays stable through the day.
-- ============================================================

create table if not exists daily_briefings (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  briefing_date   date        not null,
  headline        text        not null,
  actions         jsonb       not null default '[]',
  created_at      timestamptz not null default now(),
  unique (organization_id, briefing_date)
);

create index if not exists daily_briefings_org_idx on daily_briefings(organization_id, briefing_date desc);

alter table daily_briefings enable row level security;

create policy "org_members_daily_briefings" on daily_briefings
  for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
