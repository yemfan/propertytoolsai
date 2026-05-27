-- 00007_calendar.sql
-- Events / appointments for the calendar module.

create table if not exists events (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  client_id       uuid        references clients(id) on delete set null,

  title           text        not null,
  description     text,
  location        text,

  type            text        not null default 'appointment'
                              check (type in ('appointment', 'task', 'meeting', 'reminder')),
  color           text        not null default 'indigo'
                              check (color in ('indigo', 'emerald', 'rose', 'amber', 'slate')),

  start_at        timestamptz not null,
  end_at          timestamptz,
  all_day         boolean     not null default false,

  completed       boolean     not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_events_org_start
  on events(organization_id, start_at);

alter table events enable row level security;

create policy "members_select_events" on events
  for select using (organization_id in (select get_user_org_ids()));

create policy "members_insert_events" on events
  for insert with check (organization_id in (select get_user_org_ids()));

create policy "members_update_events" on events
  for update using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

create policy "members_delete_events" on events
  for delete using (organization_id in (select get_user_org_ids()));
