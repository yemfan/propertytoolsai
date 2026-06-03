-- ============================================================
-- Migration 00042: AI receptionist "brain" — structured config
-- ============================================================
-- Replaces the freeform voice_agent_prompt as the agent's source of truth:
--   * organizations.business_hours — per-weekday open/close (in org timezone)
--   * appointment_types            — bookable services with durations
--   * knowledge_base               — FAQ / products / services the agent answers from
-- ============================================================

-- Per-weekday hours, e.g. {"mon":{"open":"09:00","close":"17:00"}, "sun":null}
alter table organizations add column if not exists business_hours jsonb;

create table if not exists appointment_types (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id) on delete cascade,
  name             text        not null,
  duration_minutes integer     not null default 30 check (duration_minutes between 5 and 480),
  description      text,
  active           boolean     not null default true,
  sort             integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists appointment_types_org_idx on appointment_types(organization_id);
alter table appointment_types enable row level security;
create policy "org_members_appointment_types" on appointment_types
  for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
create trigger set_updated_at_appointment_types
  before update on appointment_types
  for each row execute function set_updated_at();

create table if not exists knowledge_base (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id) on delete cascade,
  title            text        not null,
  content          text        not null,
  active           boolean     not null default true,
  sort             integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists knowledge_base_org_idx on knowledge_base(organization_id);
alter table knowledge_base enable row level security;
create policy "org_members_knowledge_base" on knowledge_base
  for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
create trigger set_updated_at_knowledge_base
  before update on knowledge_base
  for each row execute function set_updated_at();
