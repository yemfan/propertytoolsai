create table if not exists agent_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  lead_id text null,
  type text not null,
  title text not null,
  message text not null,
  status text not null default 'unread',
  action_url text null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);
