-- 00012_tasks.sql
-- Task management — to-dos linked to clients, with priority and due dates.

create table if not exists tasks (
  id              uuid          primary key default gen_random_uuid(),
  organization_id uuid          not null references organizations(id) on delete cascade,
  client_id       uuid          references clients(id) on delete set null,

  title           text          not null,
  notes           text,
  due_date        date,
  status          text          not null default 'open'
                                check (status in ('open', 'in_progress', 'done', 'cancelled')),
  priority        text          not null default 'normal'
                                check (priority in ('low', 'normal', 'high', 'urgent')),

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists idx_tasks_org
  on tasks(organization_id, status, due_date);

create index if not exists idx_tasks_client
  on tasks(client_id, status);

alter table tasks enable row level security;

create policy "org_members_tasks" on tasks
  for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

-- ─── Email campaigns ──────────────────────────────────────────────────────────

create table if not exists campaigns (
  id               uuid          primary key default gen_random_uuid(),
  organization_id  uuid          not null references organizations(id) on delete cascade,

  name             text          not null,
  subject          text          not null,
  body             text          not null,   -- plain-text body (also used as email text)
  html_body        text,                     -- optional pre-built HTML

  -- Recipient segment: all, active, leads, prospects, inactive
  recipient_filter text          not null default 'active'
                                 check (recipient_filter in ('all','active','leads','prospects','inactive')),

  status           text          not null default 'draft'
                                 check (status in ('draft','sending','sent','failed')),
  recipient_count  int,
  sent_at          timestamptz,

  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index if not exists idx_campaigns_org
  on campaigns(organization_id, created_at desc);

alter table campaigns enable row level security;

create policy "org_members_campaigns" on campaigns
  for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
