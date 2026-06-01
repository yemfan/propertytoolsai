-- AI receptionist appointment booking (LeadSmart / Lucy).
--
-- 1. voice_appointments — the bookings the receptionist makes (Retell
--    book_appointment). Keyed on agent_id (-> agents.id, bigint).
-- 2. voice_receptionist_settings.booking_enabled — per-agent on/off for booking.
--    Off by default: the agent's Retell custom functions (check_availability,
--    book_appointment, create_callback) must be wired before enabling, otherwise
--    the receptionist would offer times it can't actually book.

create table if not exists public.voice_appointments (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null,
  contact_id text,
  caller_name text,
  caller_phone text,
  title text not null default 'Appointment',
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'booked',   -- booked | cancelled | completed
  source text not null default 'ai_receptionist',
  created_at timestamptz not null default now()
);

-- Conflict-safe: at most one ACTIVE booking per agent per start time, so a
-- same-slot double-booking is impossible even when the Retell agent fires
-- book_appointment several times in one call.
create unique index if not exists voice_appointments_agent_start_booked_uidx
  on public.voice_appointments (agent_id, start_at)
  where status = 'booked';

create index if not exists voice_appointments_agent_start_idx
  on public.voice_appointments (agent_id, start_at);

alter table public.voice_receptionist_settings
  add column if not exists booking_enabled boolean not null default false;

comment on table public.voice_appointments is
  'Appointments booked by the AI voice receptionist (Retell book_appointment). agent_id -> agents.id.';
comment on column public.voice_receptionist_settings.booking_enabled is
  'When true, the receptionist offers + books appointments. Requires the agent''s Retell custom functions to be wired first.';
