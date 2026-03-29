alter table leads
add column if not exists last_contact_at timestamptz null,
add column if not exists last_reply_at timestamptz null,
add column if not exists conversation_status text null default 'automated',
add column if not exists source_session_id text null;
