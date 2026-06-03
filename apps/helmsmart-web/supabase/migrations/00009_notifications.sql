-- 00009_notifications.sql
-- In-app notification center + Stripe payment columns on invoices.

-- ─── Stripe payment tracking on invoices ─────────────────────────────────────

alter table invoices
  add column if not exists stripe_session_id   text,
  add column if not exists stripe_payment_intent text;

-- ─── Notifications ────────────────────────────────────────────────────────────

create table if not exists notifications (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,

  type            text        not null,   -- invoice_paid | invoice_overdue | new_message | missed_call | booking | system
  title           text        not null,
  body            text,
  link            text,                   -- relative URL to navigate to on click

  read            boolean     not null default false,

  created_at      timestamptz not null default now()
);

create index if not exists idx_notifications_org_unread
  on notifications(organization_id, read, created_at desc);

alter table notifications enable row level security;

create policy "members_select_notifications" on notifications
  for select using (organization_id in (select get_user_org_ids()));

create policy "members_update_notifications" on notifications
  for update using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

-- Service role needs INSERT for webhook-created notifications
-- (webhooks run without a session, so we rely on service role — no RLS policy needed for service role)
