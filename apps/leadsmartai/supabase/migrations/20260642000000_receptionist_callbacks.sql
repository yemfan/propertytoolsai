-- RealtorBoss — Receptionist auto call-back ladder.
--
-- When a call is missed, the AI Receptionist doesn't stop at the
-- text-back: it schedules outbound call-backs at +5, +10, and +30
-- minutes after the miss, stopping as soon as any call with that
-- caller connects (they pick up the call-back, or they call again
-- and the receptionist answers).
--
-- Consumers (same PR):
--   • lib/missed-call/callbacks.ts            — schedule / resolve / process
--   • app/api/cron/receptionist-callbacks     — places due call-backs (*/5)
--   • app/api/retell/call-events              — resolves on connected calls
--
-- Writes go through the service role; RLS select-own is the safety
-- net, matching ai_assistants.

create table if not exists public.receptionist_callbacks (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  -- The missed call that started the ladder.
  call_log_id uuid references public.call_logs(id) on delete set null,
  phone_e164 text not null,
  -- Call-backs placed so far (0..3). Offsets from the missed call:
  -- attempt 1 at +5 min, attempt 2 at +10, attempt 3 at +30.
  attempts int not null default 0,
  next_attempt_at timestamptz,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'answered', 'exhausted', 'cancelled')
  ),
  -- Retell call_id of the most recent call-back attempt.
  last_provider_call_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active ladder per caller per agent — a second miss while a
-- ladder is running must not start a parallel one.
create unique index if not exists idx_receptionist_callbacks_active
  on public.receptionist_callbacks(agent_id, phone_e164)
  where status = 'scheduled';

create index if not exists idx_receptionist_callbacks_due
  on public.receptionist_callbacks(next_attempt_at)
  where status = 'scheduled';

alter table public.receptionist_callbacks enable row level security;

drop policy if exists "receptionist_callbacks_select_own" on public.receptionist_callbacks;
create policy "receptionist_callbacks_select_own" on public.receptionist_callbacks
  for select using (
    exists (
      select 1 from public.agents a
      where a.id = receptionist_callbacks.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

comment on table public.receptionist_callbacks is
  'AI Receptionist missed-call call-back ladder: outbound AI call-backs at +5/+10/+30 minutes until the caller is reached. Processed by /api/cron/receptionist-callbacks; resolved by the Retell call-events webhook when any call with the caller connects.';
