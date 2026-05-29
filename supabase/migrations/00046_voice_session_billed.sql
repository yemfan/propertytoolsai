-- Track which voice calls have been billed so we never double-charge
alter table voice_sessions
  add column if not exists billed_at timestamptz;
