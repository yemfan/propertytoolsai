-- Gmail 2-way sync scaffolding.
--
-- Agents connect their Gmail account via OAuth; we poll their inbox
-- every few minutes and log any message whose sender or recipient
-- matches a contact in their CRM. Threading + reply tracking reuse
-- the existing `email_messages` + `lead_events` tables — no new
-- inbox schema.
--
-- Design notes:
--   - We store Gmail OAuth as its own row in agent_oauth_tokens
--     (provider='google_mail') rather than piggy-backing on the
--     calendar grant. Google requires a fresh OAuth consent to add
--     a new scope anyway, so separating them keeps the scopes
--     auditable + lets the agent revoke one without breaking the
--     other.
--   - `gmail_history_id` is Gmail's incremental-sync cursor. On
--     each run we fetch `history.list?startHistoryId=X` and advance
--     the cursor; this is ~100x cheaper than fetching the inbox.
--     First run has no history id — falls back to messages.list
--     with a timestamp filter (last 7 days) to avoid a full-inbox
--     download on day zero.
--   - `gmail_last_synced_at` is for UI only ("Last synced 3 min ago").

alter table public.agent_oauth_tokens
  add column if not exists gmail_history_id text,
  add column if not exists gmail_last_synced_at timestamptz,
  add column if not exists gmail_sync_enabled boolean not null default true,
  add column if not exists gmail_account_email text,
  add column if not exists gmail_last_sync_error text,
  add column if not exists gmail_messages_synced integer not null default 0;

comment on column public.agent_oauth_tokens.gmail_history_id is
  'Gmail history API cursor. Advances on every successful sync.';
comment on column public.agent_oauth_tokens.gmail_last_synced_at is
  'Last successful sync run (any new messages or not).';
comment on column public.agent_oauth_tokens.gmail_sync_enabled is
  'Per-agent pause switch. Setting false skips the row in the cron.';
comment on column public.agent_oauth_tokens.gmail_account_email is
  'The Gmail address that was connected (shown in the UI).';
comment on column public.agent_oauth_tokens.gmail_last_sync_error is
  'Last error message from a failed sync run; cleared on success.';
comment on column public.agent_oauth_tokens.gmail_messages_synced is
  'Total count of messages logged to email_messages for this token.';

-- Optional audit of external message ids so we never re-insert the
-- same Gmail message twice (network retries, overlapping cron runs).
-- `email_messages.external_message_id` already exists from the
-- inbound-email webhook; we just add a partial unique index on
-- (agent_id, external_message_id) so the match cost is O(1).
create unique index if not exists idx_email_messages_agent_external_unique
  on public.email_messages (agent_id, external_message_id)
  where external_message_id is not null;
